#!/usr/bin/env node
/**
 * Records the API responses the reel films from, once, with the API running (GET only).
 *
 *   npm run fixtures                 # → fixtures/*.json + out/cache/images/*
 *
 * Read-only by construction: this script only issues GET requests, and only to the public
 * recipe endpoints. It never records an endpoint that returns people (users, testimonies), and it
 * never signs in. The API's database is shared and remote, so the reel must never write to it:
 * at capture time every response comes from these files (capture.mjs), and the signed-in
 * responses (the saved list, the save confirmation) are built here from the recorded recipes.
 *
 * Fixtures written:
 *   allRecipes.json            GET /api/allRecipes, as returned
 *   viewRecipe-<id>.json       GET /api/viewRecipe/:id for every recipe the reel opens
 *   relatedRecipe-Italian.json GET /api/relatedRecipe?cuisine=Italian, as returned
 *   approvedTestimony.json     { approved: [] } (the reel never films that section; not recorded)
 *   savedRecipes.json          mock GET /api/getSavedRecipes, built from real recipes, Margherita last
 *   saveResponse.json          mock 201 body for POST /api/savedRecipe/:id (the real response shape)
 *   meta.json                  when and from where the fixtures were recorded, and the photo list
 */
import path from "node:path";
import { createHash } from "node:crypto";
import { existsSync, promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURES = path.join(here, "fixtures");
export const IMAGE_CACHE = path.join(here, "out", "cache", "images");
const API = process.env.API_URL ?? "http://localhost:3000";

/** The recipes the reel opens (detail page, Cook Mode), plus the rest of the Italian set the wheel may land on. */
const OPENED = [/^Classic Margherita Pizza$/];
const WHEEL_SET = "Italian";
/** The demo cook's collection: real recipes, the one just saved (Margherita) last. */
const SAVED = [/^Japanese Ramen Soup$/, /^Chicken Biryani$/, /^Korean Bibimbap$/, /^Classic Margherita Pizza$/];
export const DEMO_USER_ID = "000000000000000000demo01";

/** Cache file for a photo URL: stable, flat, keeps the extension for the content type. */
export function imageCacheFile(url) {
  const u = new URL(url);
  const base = path.basename(u.pathname).replace(/[^\w.-]/g, "_");
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 10);
  return path.join(IMAGE_CACHE, `${hash}-${base}`);
}

async function getJson(pathname) {
  const url = API + pathname;
  const res = await fetch(url, { method: "GET", headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}. Is the API running on ${API}?`);
  return res.json();
}

async function write(name, data) {
  await fs.writeFile(path.join(FIXTURES, name), JSON.stringify(data, null, 2) + "\n");
  console.log(`  fixtures/${name}`);
}

/** Refuses to write anything that looks like a person or a credential. */
function assertClean(name, data) {
  const text = JSON.stringify(data);
  const bad = [
    [/[\w.+-]+@[\w-]+\.[\w.]+/, "an email address"],
    [/eyJ[\w-]{10,}\.[\w-]{10,}/, "a JWT"],
    [/"(password|passwordHash|email|username|token)"\s*:/i, "a user field"],
  ].find(([re]) => re.test(text));
  if (bad) throw new Error(`fixtures/${name} would contain ${bad[1]}; refusing to write it`);
}

async function cacheImage(url) {
  const file = imageCacheFile(url);
  if (existsSync(file)) return { file, cached: true };
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  const type = res.headers.get("content-type") ?? "image/webp";
  if (!/^image\//.test(type)) throw new Error(`${url} is ${type}, not an image`);
  await fs.writeFile(file, Buffer.from(await res.arrayBuffer()));
  await fs.writeFile(file + ".type", type);
  return { file, cached: false };
}

async function main() {
  await fs.mkdir(FIXTURES, { recursive: true });
  await fs.mkdir(IMAGE_CACHE, { recursive: true });
  console.log(`recording GET fixtures from ${API}`);

  const all = await getJson("/api/allRecipes");
  const recipes = all.response ?? [];
  if (!recipes.length) throw new Error("the API returned no recipes");
  assertClean("allRecipes.json", all);
  await write("allRecipes.json", all);

  const byName = (re) => {
    const r = recipes.find((x) => re.test(x.name ?? ""));
    if (!r) throw new Error(`no recipe matches ${re}`);
    return r;
  };
  const opened = new Map();
  for (const re of OPENED) opened.set(byName(re)._id, byName(re));
  for (const r of recipes.filter((x) => x.cuisine === WHEEL_SET)) opened.set(r._id, r);
  for (const id of opened.keys()) {
    const one = await getJson(`/api/viewRecipe/${encodeURIComponent(id)}`);
    assertClean(`viewRecipe-${id}.json`, one);
    await write(`viewRecipe-${id}.json`, one);
  }

  const related = await getJson(`/api/relatedRecipe?cuisine=${encodeURIComponent(WHEEL_SET)}`);
  assertClean(`relatedRecipe-${WHEEL_SET}.json`, related);
  await write(`relatedRecipe-${WHEEL_SET}.json`, related);

  // never recorded: the approved testimonies (people); the reel never films that section
  await write("approvedTestimony.json", { approved: [] });

  // signed-in mocks, built from the recorded recipes (the saved list's shape is the API's own)
  const saved = SAVED.map(byName).map((r, i) => ({
    _id: `5a7ed0000000000000000${String(i + 1).padStart(3, "0")}`,
    recipeId: r._id,
    name: r.name,
    image: r.image,
    userId: DEMO_USER_ID,
  }));
  await write("savedRecipes.json", saved);
  const margherita = byName(/^Classic Margherita Pizza$/);
  await write("saveResponse.json", {
    message: "Added to collection",
    newRecipe: { _id: saved[saved.length - 1]._id, recipeId: margherita._id, name: margherita.name, image: margherita.image, userId: DEMO_USER_ID, __v: 0 },
  });

  // photos: every recipe image, once
  const urls = [...new Set(recipes.map((r) => r.image).filter(Boolean))];
  let fetched = 0;
  for (const url of urls) {
    const { cached } = await cacheImage(url);
    if (!cached) fetched++;
  }
  console.log(`  out/cache/images: ${urls.length} photos (${fetched} downloaded, ${urls.length - fetched} already cached)`);

  await write("meta.json", {
    recordedAt: new Date().toISOString(),
    api: API,
    method: "GET only",
    recipes: recipes.length,
    opened: [...opened.keys()],
    images: urls,
    note: "Recipe photos are DummyJSON's (https://dummyjson.com). Saved list and save response are mocks built from the recorded recipes.",
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message ?? e);
    process.exit(1);
  });
}
