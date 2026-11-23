# Fable 5.2 UI Revamp Prompt: Cook With Me

Act as a senior product designer and Angular frontend engineer. Redesign and implement the existing **Cook With Me** recipe application as a memorable, polished cooking brand. Use the visual direction below as the source of truth, then integrate a refined version of the rotating lazy-Susan food carousel motion described later. The result should feel like one coherent design, not two references pasted together.

## First: inspect, then implement

Before editing, inspect the Angular app structure, routes, shared navigation/footer, page templates and styles, recipe model, and existing data/API bindings. The app is Angular 20 with standalone components, Angular Router, Bootstrap, and component-scoped CSS. Keep the existing stack and conventions. Do not convert the project to React/Vite or create a separate static prototype.

Implement the revamp in the existing app. Start with the public-facing experience: shared shell, home page, recipe discovery/listing, recipe detail, about/contact, login/register, saved recipes, and profile. Bring admin pages into the same visual system while preserving their information density and usable data tables/forms. Keep each page's existing purpose and working functionality.

## Product and brand

**Cook With Me** helps people discover, save, and cook approachable recipes. The brand should feel energetic, generous, editorial, and food-led: like a bold independent food magazine crossed with a lively neighbourhood kitchen. Use the ramen prompt's confidence, oversized condensed typography, strong color blocks, tightly composed poster layouts, and cut-out food photography. Do not make this restaurant-specific: no ramen-only copy, fictional address/hours, prices, booking controls, or commerce/cart UI.

## Visual system

- Build a warm tomato-red / cream foundation, with deeper red, broth-black, and a restrained yolk-yellow accent. Suggested tokens: `--paper: #C8281C`, `--ink: #FFF3E0`, `--surface: #A51F15`, `--yolk: #FFC93C`, `--broth: #1C0F0A`, `--muted: #FFE6DA`.
- Use cream on red, broth on yellow, and cream on broth. Check contrast for every text/background pairing; body copy must remain comfortably readable. Never use yellow text on red.
- Use **Dela Gothic One** for large uppercase display headlines and **Archivo** for body text, labels, controls, and navigation. Load fonts efficiently and provide sensible fallbacks.
- Favor square corners, hard-edged color blocks, solid rules, compact editorial spacing, oversized numerals, and asymmetrical compositions. Avoid generic Bootstrap cards, rounded pills, gradients, glass effects, glows, and decorative icon grids. Bootstrap may remain installed, but the finished visual language should be custom and consistent.
- Use large, appetizing recipe photography as layered cut-outs or editorial crops against the color fields. Keep image treatments intentional and consistent; avoid broken/external placeholder images. Reuse known-good project assets or select dependable image URLs, with descriptive alt text for meaningful food imagery.
- Make the site feel complete and branded at every route, including empty, loading, error, and signed-out states.

## Shared shell and navigation

- Create a confident wordmark/navigation system with clear links to Home, Recipes, About, and Contact; show account actions appropriate to authentication state and preserve admin access for authorized admins.
- Use a sticky desktop header with a strong rule and clear active-route treatment. On mobile, provide a keyboard-accessible menu that opens/closes correctly and does not cover content unexpectedly.
- Give the footer a deliberate editorial finish with the wordmark, useful navigation, and existing contact/social details only where they are already present in the app. Do not invent factual business details.

## Home page: poster hero + rotating recipe carousel

Make the home page the signature visual moment. The first screen should immediately communicate “discover something delicious to cook.” Combine a bold poster-like hero with a food carousel inspired by the Gelato Lab lazy-Susan mechanism:

- Use a strong headline such as **“GOOD FOOD. YOUR WAY.”** with a short supporting line and one clear `Explore recipes` action. Retain a secondary sign-in/join action only if it fits the existing auth flow.
- Set the hero on a rich, flat tomato or warm food-toned field, with oversized cream display type, compact uppercase labels, solid rules, and one restrained yolk block for emphasis.
- Place a top-down circular tabletop / platter motif behind the food. Arrange up to five featured recipe images around a circular path like dishes on a lazy Susan. The active dish sits large at the lower/central focal point and overlaps the display type slightly; adjacent dishes peek in at smaller scale. Use realistic food photography with a consistent top-down crop, soft natural shadows, and transparent cut-outs where available. Do not use gelato-specific props, marble-ring assets, flavor names, buy buttons, or cart icons.
- Every ~4–6 seconds, smoothly advance the active recipe by one position. Rotate the platter and dishes together; the outgoing active image arcs away and shrinks while the incoming image moves into the focal position and grows. Crossfade the hero's supporting color between a small curated set of accessible food colors, keeping the typography legible through every transition. Update the active recipe title, category/time metadata, and destination link in sync.
- Include visible previous/next controls and small position indicators so users can navigate manually. Controls must have accessible names and keyboard support. Pause auto-advance while hovered, focused, or when the page is hidden. Do not make the entire experience depend on autoplay; ensure the first frame is complete and useful before any animation runs.
- Source featured items from existing recipe data where practical. Handle zero/one recipe gracefully, avoid fabricating API fields, and keep links connected to the actual recipe-detail route. If the home API does not provide a suitable featured list, use a small local curated set only when it can link safely to valid recipe records; otherwise render a beautiful static hero without dead links.
- Keep the existing popular recipes, approved testimonials, and CTA sections, but restyle them into an intentional sequence of editorial bands, recipe rows/cards, and testimonial quotes. Remove hardcoded demo recipe cards if the app already has real recipe data available. Do not remove working API behavior.

## Recipe discovery and detail

- Turn recipe browsing into a highly scannable editorial index. Use a large page title, clear search, useful cuisine/meal filters, and responsive recipe tiles/rows with image, title, category, preparation time, and difficulty only when those fields exist in the actual model.
- Preserve live search/filter behavior and route navigation. Ensure empty results and loading/error states are designed, not browser-default.
- Make the recipe detail page feel like a feature article: prominent food image, strong title, metadata, readable ingredients and method, and clear save/download actions. Preserve existing save, PDF download, related recipes, and testimonial interactions. Keep signed-out behavior understandable and connected to existing auth flows.
- Style saved recipes and profile pages with the same system while preserving their actual CRUD/API behavior.

## Other routes and admin

- Apply the brand system to About, Contact, Login, and Register without disrupting validation, submission, or error messages.
- Restyle admin dashboard, recipe management, users, downloads, and testimony moderation. Maintain legibility, efficient controls, confirmation/error feedback, and responsive tables or sensible mobile alternatives. Do not change authorization, API contracts, route guards, or business logic as part of visual work.

## Motion and implementation

- Use Angular-compatible CSS/TypeScript animation; do not introduce React, a standalone HTML page, or a heavyweight animation dependency just for the carousel. Prefer transform/opacity animations and keep layout stable. If a motion library is already installed, inspect and use it only if appropriate.
- Use a single carousel state/timer so image position, active copy, and color transition stay synchronized. Clean up timers/listeners on component destroy. Avoid animation work while the tab is hidden.
- Honor `prefers-reduced-motion`: disable rotation, spring movement, and automatic color interpolation; present a stable active recipe and let users navigate with immediate or subtle fade changes. Do not rely on motion to convey state.
- Keep controls at least 44px targets, visible focus states, semantic headings/landmarks, keyboard-operable navigation, and accessible contrast. Decorative platter/food elements should be hidden from assistive technology; active recipe imagery and copy must have meaningful text alternatives.
- On small screens, recompose rather than merely shrink: stack headline and carousel, keep the active dish prominent without blocking copy/controls, make carousel controls reachable, and prevent horizontal overflow. Respect safe-area insets if a fixed mobile element is used.
- Keep CSS scoped and maintainable. Remove obsolete home-page inline styles and unused demo markup. Do not add unrelated dependencies or alter backend/API behavior.

## Quality bar / completion

The finished app should look art-directed and unmistakably food-focused: bold red-and-cream typography, real appetite appeal, clean hierarchy, and a carousel motion that feels like dishes gliding around a shared table. It must still work as the existing recipe application, not just look like a concept landing page.

After implementation, summarize the key files changed, describe the home carousel behavior and accessibility choices, and report any existing data limitations that affected featured recipes. Run the project build and relevant checks, and fix any regressions you introduce.
