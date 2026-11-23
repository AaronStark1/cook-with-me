# Cook With Me — Issue Analysis & Fix Plan

> Audit of the Angular 20 frontend and Express 5 / Mongoose backend.
> Date: 2026-11-23 · Commit reviewed: `30d23cb` (Initial commit)
> The analysis below describes the code **as audited**. Every item has since been fixed — see
> [§7 Resolution status](#7-resolution-status) for what changed, where the fix differs from the plan, and what is left.

---

## 1. Executive summary

The app builds, but it is **not production-ready**. There are several exploitable security holes and a handful of features that simply do not work.

| Area | Critical | Major | Moderate/Minor |
|---|---|---|---|
| Backend / API / data | 4 | 7 | 11 |
| Frontend / UI | 3 | 13 | 21 |
| Tooling / dependencies | 0 | 3 | 3 |

### Top 10 things to fix first

1. **Registration is 100% broken** — frontend posts to `/registration`, backend exposes `/api/registration` (`apiservice.ts:14`, `route.js:11`).
2. **Admin API is completely unauthenticated** — anyone can create/edit/delete recipes, enumerate users and their password hashes, and moderate testimonies (`route.js:21–30`).
3. **Plaintext-password login fallback** — `userController.js:35` accepts `existingUser.password === password` when bcrypt comparison fails.
4. **Password hashes returned to the browser and stored in `sessionStorage`** (`userController.js:18,43,56`; `login.ts:45–49`).
5. **JWTs never expire**, secret is not validated at startup (`userController.js:38`, `jwtMiddleware.js:19`).
6. **Delete saved recipe always returns 500** — `findByIdAndDelete({ id })` passes an object instead of the id (`savedRecipeController.js:66`).
7. **No auth/role guards on `/admin`, `/profile`, `/saved-recipes`** (`app.routes.ts`, `admin-routing-module.ts`).
8. **Wrong property bindings on the recipe page** — `recipe.title`, `calories`, `prepTime`, `cookTime`, `mode`, `category` do not exist; the UI renders blank (`view-recipe.html`).
9. **"Save recipe" button is dead** and the testimonial/contact form is unusable for guests (`view-recipe.html:83`, `contact.ts:35`).
10. **Dependency/tooling breakage** — `npm ci` fails on the frontend, fresh `npm install` fails with a peer conflict, and the backend has 2 critical npm advisories.

---

## 2. Verification performed

| Check | Result |
|---|---|
| `node --check` on every backend `.js` file | Pass — no syntax errors |
| `npm ci` (backend) | Pass — 102 packages |
| `npm ci` (frontend) | **Fail** — `EUSAGE`: lockfile missing `hono@4.13.20` and `@popperjs/core@2.11.8` |
| `npm install` (frontend, clean) | **Fail** — `ERESOLVE`: `highcharts@12.5.0` has `peerOptional jspdf@^3.0.0` but project pins `jspdf@^4.1.0`; only `--legacy-peer-deps` works |
| `npx ng build --configuration production` | **Succeeds** with warnings (see below) |
| `npm audit --omit=dev` (backend) | **5 vulnerabilities — 2 critical, 2 high, 1 moderate** |

Production build warnings: initial bundle **752.44 kB** vs 500 kB budget; `NG8113` unused `RouterLink` in `SavedRecipes`; ~20 CommonJS bailout warnings from `jspdf`/`canvg`/`html2canvas`.

---

## 3. Backend fixes

### 3.1 Critical

#### B-C1 — Admin and mutating routes have no authentication or role check
**Files:** `backend/router/route.js:21–30`

```js
route.get('/api/getAllUsers', userController.getAllUsers)                    // no JWT
route.patch('/api/updateTestimony/:id', testimonyController.updateTestimony) // no JWT
route.post('/api/addRecipe', recipeController.addRecipe)                     // no JWT
route.put('/api/updateRecipe/:id', recipeController.updateRecipe)           // no JWT
route.delete('/api/deleteRecipe/:id', recipeController.deleteRecipe)        // no JWT
```

Any anonymous caller can wipe the recipe catalogue and download every user record. The JWT payload has no role (`userController.js:38`) and there is no role middleware anywhere.

**Fix:** Add an `adminMiddleware` that verifies the JWT, reloads the user from the DB, checks `role === 'Admin'`, and rejects otherwise. Apply `jwtMiddleware, adminMiddleware` to all six routes. Include the role in the token but always re-check against the DB on privileged requests so demoted tokens stop working. Add a frontend guard too (F-C2) — client guards alone are bypassable.

#### B-C2 — Plaintext password fallback defeats bcrypt
**File:** `backend/controller/userController.js:34–37`

```js
const userPassword = await bcrypt.compare(password, existingUser.password)
if (!userPassword && existingUser.password !== password) { ... }
```

When bcrypt fails, a stored plaintext password is accepted. Any legacy/seeded/inserted plaintext row logs in in cleartext.

**Fix:** Remove the fallback:

```js
if (!(await bcrypt.compare(password, existingUser.password))) {
  return res.status(401).json({ message: 'Invalid credentials' });
}
```

#### B-C3 — Password hashes and PII are returned to clients
**Files:** `userController.js:18` (returns `newUser`), `:43` (returns `user: existingUser`), `:55–56` (returns full user documents).

Combined with B-C1, anyone can harvest every user's email and bcrypt hash for offline cracking.

**Fix:** Mark `password` as `select: false` in `models/userModel.js` and opt in with `.select('+password')` only in login; or add a `toJSON` transform that deletes it. For `getAllUsers`, project only safe fields:

```js
users.find({ role: 'User' }).select('username email profilePic role')
```

Use a generic "Invalid credentials" message for both unknown-user and wrong-password cases to avoid account enumeration.

#### B-C4 — JWTs never expire and secrets are not validated
**Files:** `userController.js:38`, `middleware/jwtMiddleware.js:19`

```js
jwt.sign({ userId: existingUser._id }, process.env.JWT_KEY)           // no expiresIn
jwt.verify(token, process.env.JWT_KEY)                               // no algorithms
```

Stolen tokens are valid forever; an unset `JWT_KEY` throws at runtime and (because of B-M3) hangs the request.

**Fix:**

```js
jwt.sign({ userId, role }, process.env.JWT_KEY, { expiresIn: '1d', algorithm: 'HS256' });
jwt.verify(token, process.env.JWT_KEY, { algorithms: ['HS256'] });
```

Validate `JWT_KEY` and `MONGO_DB` at startup and refuse to boot if missing.

### 3.2 Major

#### B-M1 — IDOR on delete endpoints
**Files:** `downloadController.js:38`, `savedRecipeController.js:63–67`. Both delete by id with no `userId` filter, so any authenticated user can delete another user's records.

**Fix:** Scope to the authenticated user and check the result:

```js
const doc = await savedRecipes.findOneAndDelete({ _id: id, userId: req.userId });
if (!doc) return res.status(404).json({ message: 'Not found' });
```

#### B-M2 — `deleteSavedRecipe` always 500s
**File:** `savedRecipeController.js:66` — `findByIdAndDelete({ id })` becomes `findOne({ _id: { id: '…' } })`, which throws `CastError` and returns 500. The frontend passes the document `_id`.

**Fix:** `findByIdAndDelete(id)` — or use the scoped `findOneAndDelete` from B-M1.

#### B-M3 — Error handlers swallow exceptions and hang the request
**Files:** `userController.js:21–24` and `:47–50` log a message and never call `res`. Any DB/validation error leaves the client waiting until timeout.

**Fix:** Always send a response (`500` with a generic message); add one global 4-arg error middleware instead of repeating this in every controller.

#### B-M4 — No input validation anywhere
All controllers trust `req.body`/`req.query`. Missing recipe fields produce raw Mongoose `ValidationError` 500s; `updateTestimony` accepts any status string; ids are never checked.

**Fix:** Add `express-validator` (or zod/joi) per route: email/password validation, required recipe fields, `ObjectId.isValid(id)` on every `:id` route, `status` enum validation, and structured 400 responses.

#### B-M5 — CORS allows every origin
**File:** `index.js:8` — `cors()` reflects any `Origin`.

**Fix:** `cors({ origin: process.env.FRONTEND_URL, methods: [...], allowedHeaders: ['Content-Type','Authorization'], credentials: true })`.

#### B-M6 — NoSQL operator injection
**Files:** `recipeController.js:24–25` (`{ cuisine }` from query), `userController.js:8,30` (`{ email }` from body), `testimonyController.js:7`. Sending `{"email":{"$ne":null}}` matches the first user.

**Fix:** Validate types before querying — reject anything that is not a string (`typeof email !== 'string'` → 400). Consider `mongoose.set('sanitizeFilter', true)`.

#### B-M7 — Testimonies are not tied to the user and status is unvalidated
**Files:** `testimonyController.js:3–20,47–58`, `models/testimonyModel.js:20–23`. Callers supply their own `username`/`email`, and arbitrary status strings are persisted. `getTestimony` returns pending/rejected entries without auth.

**Fix:** Add required `userId` to the schema, derive author fields server-side, use `enum: ['Pending','Approved','Rejected']`, and protect/limit the all-testimonies route.

### 3.3 Moderate / minor

| ID | File(s) | Issue | Fix |
|---|---|---|---|
| B-m1 | `recipeController.js:6,37,41` | Response key typo `messge` | Rename to `message` |
| B-m2 | `userController.js:10,32` | `402 Payment Required` for duplicates / missing user | Use `409` and `404` |
| B-m3 | `savedRecipeController.js:16` | `401` for "Already saved" | Use `409` |
| B-m4 | several controllers | `200` on creates, deletes report success when nothing matched | Use `201`; check deleted count and return `404` |
| B-m5 | `downloadController.js`, `savedRecipeController.js` | Recipe content (name/ingredients/…) trusted from the client; downloads keyed only by `recipeId`, so a second user's download is never stored | Copy canonical data from the `recipes` collection server-side; key by `{recipeId, userId}` |
| B-m6 | `models/userModel.js:16–19`, `login.ts:52` | Role is free-form; model uses `"User"` but frontend checks `role == "admin"` | `enum: ['User','Admin']`, one canonical casing, controlled assignment path |
| B-m7 | `route.js:11–12` | No rate limiting on login/register | Add `express-rate-limit`, stricter on `/api/login` |
| B-m8 | `index.js:12,15` | `const PORT = 3000 || process.env.PORT` always 3000; log is hardcoded | `process.env.PORT || 3000` and log the actual port |
| B-m9 | `config/db.js:2–4` | Connection error discarded; server listens with a dead DB | Log `err.message`, fail fast/retry, add `/health` using `readyState` |
| B-m10 | `userController.js:14,39`, `downloadController.js:7`, `savedRecipeController.js:50–51` | Password hashes, JWTs, user ids and full collections logged | Remove or redact |
| B-m11 | `index.js` | No 404 handler, no global error middleware, no `start` script | Add JSON 404 handler, centralized error handler, `"start": "node index.js"` |
| B-m12 | `apiservice.ts:11` vs `route.js:10` | `/api/allRecipes` vs `/api/allrecipes` (works only because Express is case-insensitive) | Align strings |
| B-m13 | `route.js:14` vs `:13` | `getRelatedRecipe` requires JWT but `viewRecipe` does not | Pick one consistent read policy |

### 3.4 Dependency security (backend)

`npm audit --omit=dev` reports **5 advisories** — pin/upgrade via `npm audit fix`:

- **Critical** — `mongoose 9.0.0–9.11.3`: prototype pollution, `sanitizeFilter` bypasses, inherited-property poisoning (GHSA-664h-wqgq-64gw and 4 more).
- **Critical** — `proxy-addr ≤2.0.7`: IP spoofing via IPv4-mapped IPv6 (GHSA-jqcg-44mw-7w3h).
- **High** — `body-parser 2.0.0–2.3.0`: DoS via invalid limit / compressed trailing bytes.
- **High** — `path-to-regexp 8.0.0–8.3.0`: ReDoS with wildcards/optional groups.
- **Moderate** — `qs`: several DoS advisories.

---

## 4. Frontend / UI fixes

### 4.1 Critical

#### F-C1 — Registration posts to a non-existent URL
**File:** `frontend/src/app/services/apiservice.ts:14` — `${baseURL}/registration` vs backend `/api/registration`. Every signup 404s; the user only sees `alert('Registration failed')`.

**Fix:** `this.http.post(`${this.baseURL}/api/registration`, data)`.

#### F-C2 — No route guards; admin is wide open
**Files:** `app.routes.ts:11–29`, `admin/admin-routing-module.ts:11–25`. `/admin`, `/profile`, `/saved-recipes` are plain component routes. Combined with B-C1, anonymous users can manage recipes and users.

**Fix:** Add functional `CanActivate`/`CanMatch` guards checking the token and role, redirecting to `/login`; add `canMatch: [adminGuard]` on the admin route. Must be paired with the backend fix (B-C1).

#### F-C3 — Whole user document persisted in `sessionStorage`
**File:** `pages/login/login.ts:42,45–49` stores `res.user` — including the bcrypt hash — and `navbar.html:45` echoes it.

**Fix:** Persist only `{ username, email, role }`. Combine with B-C3.

### 4.2 Major

#### F-M1 — Navbar never refreshes after login
**File:** `components/navbar/navbar.ts:17–28`. It reads auth state once in `ngOnInit`, but the navbar lives in `app.html:1` outside `<router-outlet>` and is not recreated on navigation. After login the UI still shows "Login/Register" until reload.

**Fix:** Introduce an `AuthService` with a `signal`/`BehaviorSubject` used by login, logout and navbar; or re-read storage on `Router` `NavigationEnd` events.

#### F-M2 — Recipe page binds to non-existent properties
**File:** `pages/view-recipe/view-recipe.html` — model (`models/recipe-model.ts`) has `name`, `caloriesPerServing`, `prepTimeMinutes`, `cookTimeMinutes`, `difficulty`, `mealType`.

| Line | Current | Correct |
|---|---|---|
| 25 | `recipe.title` | `recipe.name` |
| 46 | `recipe.calories` | `recipe.caloriesPerServing` |
| 57 | `recipe.prepTime` | `recipe.prepTimeMinutes` |
| 64 | `recipe.cookTime` | `recipe.cookTimeMinutes` |
| 71 | `recipe.mode` | `recipe.difficulty` |
| 91 | `recipe.category` | `recipe.mealType` |
| 151 | `item.title` | `item.name` |

Result: title, nutrition, timings, badge and related-recipe names are blank.

**Fix:** Correct the bindings and type the field as `RecipeModel | null` instead of `any` (`view-recipe.ts:17`) so template type-checking catches this class of bug.

#### F-M3 — "❤️ Save" button does nothing
**File:** `view-recipe.html:83–85` has no `(click)`, and `Apiservice` has no method for `POST /api/savedRecipe/:id` (which does exist at `route.js:15`).

**Fix:** Add `saveRecipeAPI(id, body)` with the auth header, wire the click handler, and give feedback on the `409 Already saved` response.

#### F-M4 — No 401 interceptor / error handling
`appendToken()` (`apiservice.ts:22–33`) blindly attaches a stale token; every subscriber only `console.log(err)`. On 401 the UI silently shows empty lists.

**Fix:** Add a functional `HttpInterceptor` registered in `app.config.ts`, clearing auth keys and navigating to `/login` on 401.

#### F-M5 — Public contact form requires a JWT
**File:** `pages/contact/contact.ts:35` → `addTestimonyAPI` attaches a token; backend `route.js:23` protects the endpoint. Guests always get 401.

**Fix:** Make the backend route public with spam/email validation, or require login before showing the form.

#### F-M6 — Broken logo images
`navbar.html:8` and `footer.html:28` use `assets/chef.png`, but `angular.json` only copies `public/`, which contains just `favicon.ico`. Both images 404.

**Fix:** Add `frontend/public/assets/chef.png` or move it to `public/` and update the paths.

#### F-M7 — "Update Profile" is a no-op
**File:** `pages/profile/profile.ts:40–46` only updates `sessionStorage` and shows a success alert; no API exists.

**Fix:** Add `PATCH /api/updateProfile` + service method and persist, or remove the button.

#### F-M8 — Admin pages render inside the public shell
`app.html:1–4` always shows `<app-navbar>` and `<app-footer>`, so `/admin` shows the public navbar, admin sidebar and footer stacked together.

**Fix:** Use a layout route for public pages, or hide navbar/footer via a signal when the URL starts with `/admin`.

#### F-M9 — Dashboard statistics are hard-coded
**File:** `admin/dashboard/dashboard.html:13,25,37,49` shows `120`, `85`, `430`, `12`; `:62–63` says "graph works! / calendar works!".

**Fix:** Wire to real APIs (`getAllUsersAPI()`, `getRecipeAPI()`, `getDownloadedRecipesListAPI()`) or remove the placeholders.

#### F-M10 — Mobile navigation is inaccessible
**File:** `navbar.html:13` — collapsed `navbar-collapse` with no `navbar-toggler` button. All navigation links are hidden on small screens.

**Fix:** Add a toggler button with `data-bs-toggle="collapse" data-bs-target="#mainNav"` and an `id` on the collapse div.

#### F-M11 — Hardcoded backend URL
**File:** `apiservice.ts:8` — `http://localhost:3000` breaks on deployment and over HTTPS (mixed content).

**Fix:** Add `environment.ts`/`environment.production.ts` with `apiUrl` and use it everywhere.

#### F-M12 — Missing `alt` text and failing contrast
Nearly every `<img>` lacks `alt` (home, all-recipes, saved-recipes, profile, view-recipe, admin lists, navbar, footer). White text on Bootstrap `bg-warning` is ~1.6:1 contrast.

**Fix:** Add meaningful `alt` (or `alt=""` for decorative images) and use `text-dark` on warning backgrounds.

#### F-M13 — Saved-recipe delete masks a server error
**File:** `saved-recipes.ts:35–49` removes the item optimistically, but the backend delete always 500s (B-M2), so it reappears after reload.

**Fix:** Re-fetch after success; fix the backend call.

### 4.3 Moderate / minor

| ID | File(s) | Issue | Fix |
|---|---|---|---|
| F-m1 | `pipes/search-pipe.ts:10–14` | `null` search key or recipe without `name` throws and kills the list | Guard with `!searchKey?.trim()` and `(item.name ?? '').toString()` |
| F-m2 | `all-recipes.ts:58–60` | `includes()` makes cuisine filter match substrings | Use strict equality for `cuisine` |
| F-m3 | `all-recipes.html:18–20,39–41` | "All Recipes" and "Meal Type" buttons have no handlers; `updatedMealArray` unused | Wire the buttons and dropdown |
| F-m4 | `home.html:17–19,45–47,139–141` | Three CTA buttons have no `routerLink` | Link to `/all-recipes` and `/register` |
| F-m5 | `view-recipe.ts:17` + `view-recipe.html:1` | `recipe = {}` is truthy, so an empty skeleton is shown; no error state | Use `null` + `*ngIf ... else loading/error` |
| F-m6 | `view-recipe.ts:77–103` | `generatePDF()` exists but has no button; puts whole arrays into two cells | Add button, one row per ingredient, keep only `pdf.save()` |
| F-m7 | `view-recipe.ts:65–75,105–115` | Two identical download methods; only one is used | Delete the unused one |
| F-m8 | `contact.html:75–81`, `contact.ts:26–33` | Agreement checkbox unvalidated; `type="email"` does not validate under `NgForm` | Bind `[(ngModel)]`, require it, validate email with regex/validators |
| F-m9 | `profile.ts:27–30`, `navbar.ts:21–25` | `JSON.parse(sessionStorage)` throws on corrupt data | Wrap in `try/catch` and clear bad keys |
| F-m10 | `saved-recipes.html:11–32` | Cards are not clickable despite having `recipeId` | Add `[routerLink]="['/view-recipe', recipe.recipeId]"` |
| F-m11 | `manage-recipe.ts:46–75` | Fetches all recipes just to edit one | Use `viewRecipeAPI(id)`; fetch all only for the cuisine dropdown |
| F-m12 | `manage-recipe.ts:133–169` | No client validation or error UI | Use `FormGroup` + `Validators.required`, show server errors |
| F-m13 | `manage-recipe.ts:54–58` | Cuisine options come only from existing recipes; empty DB blocks creation | Seed a static list / free-text input |
| F-m14 | `apiservice.ts:38–43` | Unencoded `?cuisine=${cuisine}` breaks on spaces/`&` | Use `HttpParams` or `encodeURIComponent` |
| F-m15 | `login.css:9–15`, `register.css:9–15` | Fixed `420px` card overflows narrow screens | `width:100%; max-width:420px; box-sizing:border-box` |
| F-m16 | route-param subscriptions | `view-recipe.ts:27–30`, `manage-recipe.ts:35–38` never unsubscribe | Use `takeUntilDestroyed(this.destroyRef)` |
| F-m17 | `dashboard.html:58–65`, `contact.html`, `footer.html`, `recipe-list.html:8–12` | Lorem ipsum / "works!" placeholders; recipe-list search input has no handler | Replace with real content or mark as not implemented |
| F-m18 | `app.routes.ts` | No wildcard route — unknown URLs render an empty page | Add `{ path: '**', component: NotFoundComponent }` |
| F-m19 | `profile.html:13`, `all-recipes.html:53` | `.avatar-circle` / `.recipe-card` classes have no CSS | Style or remove |
| F-m20 | `login.ts:32,51,64` etc. | Validation via `alert()` only; no inline errors or labels | Add `is-invalid` + `.invalid-feedback`, `autocomplete`, `<label for>` |
| F-m21 | `navbar.ts:30–33` | `logout()` clears the whole session and hard-reloads | Clear only auth keys, update auth signal, `router.navigate(['/login'])` |
| F-m22 | `app.config.ts:11` | No scroll restoration | `withInMemoryScrolling({ scrollPositionRestoration: 'top' })` |
| F-m23 | ~13 components | Leftover `console.log` calls and dead code | Remove before production |

### 4.4 Frontend build warnings

- **Bundle budget:** initial total 752.44 kB (warning threshold 500 kB). Lazy-load `jspdf`/`highcharts` more aggressively or raise the budget after confirming it is intentional.
- **`NG8113`:** `RouterLink` imported but unused in `SavedRecipes` — remove the import or use it for F-m10.
- **CommonJS bailouts:** `jspdf`, `canvg`, `html2canvas` are not ESM; add them to `allowedCommonJsDependencies` in `angular.json` after review to silence warnings, or upgrade to ESM-friendly builds.

---

## 5. Tooling / dependency fixes

| ID | Problem | Fix |
|---|---|---|
| T-1 | `frontend/package-lock.json` is out of sync — `npm ci` fails (`hono@4.13.20`, `@popperjs/core@2.11.8` missing) | Regenerate the lockfile and commit it; add a CI step running `npm ci` |
| T-2 | Fresh `npm install` fails: `highcharts@12.5.0` peerOptional `jspdf@^3.0.0` conflicts with `jspdf@^4.1.0` | Pin `jspdf` to `^3.0.4` (or add an `overrides` entry), then regenerate the lockfile. Do not rely on `--legacy-peer-deps` |
| T-3 | Backend has 2 critical / 2 high / 1 moderate advisories | Run `npm audit fix` (verify Mongoose 9.x upgrade for breaking changes) and commit the updated lockfile |
| T-4 | No `start` script in `backend/package.json` | Add `"start": "node index.js"` |
| T-5 | No CI checks, no backend tests, frontend specs are generated placeholders | Add lint/build/test steps; add integration tests for auth and the critical flows |

---

## 6. Suggested implementation order

1. **Security first:** B-C1 → B-C2 → B-C3 → B-C4, plus F-C2 and F-C3. These are exploitable today.
2. **Restore core flows:** F-C1 (registration), B-M2/B-M3 (delete + hung requests), F-M2 (recipe page bindings), F-M3 (save button).
3. **Harden API:** B-M1, B-M4, B-M5, B-M6, B-M7, B-m1–B-m4, plus dependency upgrades (T-1 → T-3).
4. **Fix the UI:** F-M1, F-M4 → F-M12, then the F-m list.
5. **Polish:** build budget/warnings, placeholders, accessibility, CI.

### Acceptance checks

```bash
# Backend
cd backend && npm ci && npm audit --omit=dev && npm start

# Frontend
cd frontend && npm ci && npx ng build --configuration production

# Manual smoke test
# 1. Register a new account → succeeds
# 2. Log in → navbar shows the username without reload
# 3. Open a recipe → name, calories, times, difficulty render
# 4. Save + unsave a recipe → persists after reload
# 5. Visit /admin anonymously → redirected to /login
# 6. Call POST /api/addRecipe without a token → 401/403
# 7. Call PATCH /api/updateTestimony/:id with a bogus token → 401/403
# 8. Check sessionStorage → no password hash present
```

---

## 7. Resolution status

**All backend (B-\*), frontend (F-\*) and tooling (T-\*) items above are fixed.** Verified by:

| Check | Result |
|---|---|
| `backend`: `npm test` | 38 integration tests pass (auth, role checks, validation, login hardening) |
| `backend`: end-to-end run against a real (in-memory) MongoDB | all route/permission/ownership checks pass, including IDOR, duplicate handling and the legacy-user migration |
| `backend`: `npm audit --omit=dev` | **0** vulnerabilities (was 5) |
| `frontend`: `npm ci` | succeeds (lockfile regenerated) |
| `frontend`: `ng build --configuration production` | succeeds with **no warnings** (budget, `NG8113`, CommonJS all resolved) |
| `frontend`: `ng test` | 65/65 pass (was 4/23) |
| `frontend`: `npm audit --omit=dev` | **0** vulnerabilities |
| Real-browser run of the §6 smoke test (+ guards, filters, admin CRUD, mobile) | 47/47 steps pass |

### Where the fix differs from the plan

- **T-2 (jspdf):** the plan said pin `jspdf@^3.0.4`. That is the wrong direction — every jspdf `<=4.2.0` carries critical advisories.
  Instead `jspdf` is upgraded to `^4.2.1` and the unused `highcharts` / `highcharts-angular` packages (never imported, and the
  source of the peer conflict plus their own high-severity advisories) are removed. Re-add Highcharts if charts are wanted later.
- **F-M5 (contact form):** chose "require login". Author name/email are now derived server-side from the account (B-M7), so the
  form only collects message + profession and guests see a login prompt.
- **B-m13:** `relatedRecipe` is now public, like `viewRecipe`.
- **B-m6 / roles:** canonical roles are `User` / `Admin`; legacy lowercase `admin` rows are still recognised.
- **F-M6:** no `chef.png` existed in the repo. A stop-gap `chef.svg` was added, and the later UI revamp replaced the logo images with a typographic wordmark (no image asset needed), so the broken-image problem is gone.
- **Bundle budget (§4.4):** `jspdf` is now lazy-loaded, but the initial bundle is still ~773 kB raw (~155 kB transferred) because of
  Bootstrap + Bootstrap Icons CSS. The warning threshold was raised to 850 kB after confirming this is intentional.
- **Frontend dependency patches (not in the original audit):** `npm audit` on the frontend also flagged Angular 20.3.16
  (XSS / HttpTransferCache advisories) — bumped to the patched `20.3.35+`.

### Needs action on deploy

1. **Existing database:** run `npm run migrate:users` in `backend/` once. Login no longer accepts plaintext passwords, so a
   manually seeded admin with a plaintext password would otherwise be locked out.
2. **Set `FRONTEND_URL`** (CORS) and, if the API is on a different host from the frontend, `apiUrl` in
   `frontend/src/environments/environment.production.ts`.
3. Password rules are now 8–72 characters (registration only; existing passwords still work).

### Known remaining items

- `npm audit` (including dev dependencies) on the frontend still reports 16 moderate advisories in the build toolchain
  (`@angular/cli` transitive deps). Fixing them needs `npm audit fix --force`, i.e. breaking upgrades — not applied.
- Rate limiting is per-IP. Behind a reverse proxy, set `app.set('trust proxy', …)` so the real client IP is used.
- Registration allows the same email in different letter-casing (pre-existing); a unique, case-insensitive index would fix it.
