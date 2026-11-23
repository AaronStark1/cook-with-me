# Cook With Me 🍳

A full-stack recipe management application built with **Angular** (frontend) and **Express.js + MongoDB** (backend).

## Project Structure

```
cook-with-me/
├── frontend/       # Angular 20 application
├── backend/        # Express.js REST API
├── .github/        # CI workflow
└── README.md
```

## Frontend (Angular)

### Setup
```bash
cd frontend
npm ci
npm start
```
Runs on `http://localhost:4200` and talks to the API at `http://localhost:3000`.

### Configuration
The API base URL lives in `src/environments/`:

| File | Used for | `apiUrl` |
|------|----------|----------|
| `environment.ts` | `npm start` / development | `http://localhost:3000` |
| `environment.production.ts` | `ng build` (production) | `''` — same origin (`/api/...`). Set a full `https://` URL if the API is hosted elsewhere. |

### Scripts
```bash
npm test                                   # unit tests (Karma + Chrome)
npx ng test --watch=false --browsers=ChromeHeadlessCI   # headless / CI
npx ng build --configuration production
```

### Design system
The UI is a custom brand layer over Bootstrap's reset and grid (Bootstrap's JavaScript is no longer loaded).
- **Tokens and primitives** live in `src/styles.css`: palette (`--paper` tomato, `--ink` cream, `--surface`, `--yolk`, `--broth`, `--muted`),
  fonts (Dela Gothic One for display, Archivo for text — self-hosted from `@fontsource`, latin subset only), and shared classes
  (`.band--*`, `.btn-cwm`, `.tag`, `.photo`, `.state`/`.loader`, form/alert/table styles). Component CSS stays scoped next to each component.
- **Contrast rules:** cream on red or broth, broth on yolk or cream. Yellow is never used for text on red. Focus rings are a broth + yolk double ring so they show on every surface.
- **Home hero** (`components/hero-carousel`): a poster hero with a rotating "lazy-Susan" platter of up to five recipes taken from the API.
  One `turns` signal drives dish positions, platter rotation, active copy, position dots and the field colour. It auto-advances every ~5s,
  pauses on hover, focus, a hidden tab or the pause button, and does not autoplay or animate under `prefers-reduced-motion`.
  With no recipes it renders a static hero with no dead links.
- Recipe photos fall back to a branded plate (`assets/plate.svg`) if an image URL fails (`appImgFallback` directive).

### Features
- Browse & search recipes, filter by cuisine and meal type
- User registration & login (session kept in `sessionStorage`, only `username/email/role` — never the password hash)
- Save favorite recipes, download recipes as PDF
- Profile page with editable name/email
- Admin area (recipes, users, downloads, testimony moderation, live dashboard) — guarded on the client **and** enforced by the API

## Backend (Express.js)

### Setup
```bash
cd backend
npm ci
cp .env.example .env   # then fill in your values
npm start
```

### Environment Variables
| Variable          | Required | Description |
|-------------------|----------|-------------|
| `MONGO_DB`        | yes      | MongoDB connection string |
| `JWT_KEY`         | yes      | Secret for signing JWTs — use a long random value. The server refuses to start without it. |
| `PORT`            | no       | Port to listen on (default `3000`) |
| `FRONTEND_URL`    | no       | Comma-separated browser origins allowed by CORS (default `http://localhost:4200`) |
| `JWT_EXPIRES_IN`  | no       | Token lifetime, e.g. `1h`, `1d` (default `1d`) |

### Scripts
```bash
npm start                  # run the API
npm test                   # integration tests (no database needed)
npm run migrate:users      # one-off, see below
```

### Admin accounts
Registration always creates a regular user (`role: "User"`). To create an admin, set `role` to `"Admin"` on a
user document directly in MongoDB (the old lowercase `"admin"` is still recognised).

> **Upgrading an existing database?** Login no longer accepts plaintext passwords, and roles are now `User` / `Admin`.
> Run `npm run migrate:users` once to hash any plaintext passwords (e.g. a manually seeded admin) and normalise role casing.

### API overview
| Access | Endpoints |
|--------|-----------|
| Public | `POST /api/registration`, `POST /api/login`, `GET /api/allRecipes`, `GET /api/viewRecipe/:id`, `GET /api/relatedRecipe?cuisine=`, `GET /api/getApprovedTestimony`, `GET /health` |
| Signed-in user | `PATCH /api/updateProfile`, saved recipes (`POST /api/savedRecipe/:id`, `GET /api/getSavedRecipes`, `DELETE /api/deleteSavedRecipe/:id`), downloads (`POST /api/addDownload/:id`, `GET /api/getDownload`, `DELETE /api/deleteDownload/:id`), `POST /api/addTestimony` |
| Admin only | `GET /api/getAllUsers`, `GET /api/getDownloadedRecipesList`, `GET /api/getTestimony`, `PATCH /api/updateTestimony/:id`, `POST /api/addRecipe`, `PUT /api/updateRecipe/:id`, `DELETE /api/deleteRecipe/:id` |

Errors are JSON: `{ "message": "...", "errors": [{ "field", "message" }] }` (the `errors` list appears on validation failures).

## Tech Stack
- **Frontend**: Angular 20, Bootstrap 5, jsPDF (loaded on demand)
- **Backend**: Express.js 5, Mongoose 9, JWT, bcrypt, express-validator, express-rate-limit
- **Database**: MongoDB Atlas
- **CI**: GitHub Actions — backend tests + audit, frontend build + tests + audit
