/**
 * The recorded fixtures, read once (shared by capture.mjs, the shot lists and the smoke run).
 */
import path from "node:path";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { FIXTURES } from "../fixtures.mjs";

let FX = null;
/** The recorded fixtures (read once). */
export function fixtures() {
  if (FX) return FX;
  if (!existsSync(path.join(FIXTURES, "allRecipes.json"))) throw new Error("No fixtures: run `npm run fixtures` with the API on :3000 first.");
  const read = (name) => JSON.parse(readFileSync(path.join(FIXTURES, name), "utf8"));
  const views = new Map();
  for (const f of readdirSync(FIXTURES)) {
    const m = f.match(/^viewRecipe-(.+)\.json$/);
    if (m) views.set(m[1], read(f));
  }
  const related = {};
  for (const f of readdirSync(FIXTURES)) {
    const m = f.match(/^relatedRecipe-(.+)\.json$/);
    if (m) related[m[1]] = read(f);
  }
  FX = { all: read("allRecipes.json"), views, related, approved: read("approvedTestimony.json"), saved: read("savedRecipes.json"), saveResponse: read("saveResponse.json") };
  FX.recipes = FX.all.response;
  FX.byName = (re) => {
    const r = FX.recipes.find((x) => re.test(x.name ?? ""));
    if (!r) throw new Error(`no recipe in the fixtures matches ${re}`);
    return r;
  };
  return FX;
}

