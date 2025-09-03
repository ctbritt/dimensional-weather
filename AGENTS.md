# Repository Guidelines

## Project Structure & Module Organization
- scripts/: ES modules for logic (e.g., main.js, settings.js, weather-engine.js).
- styles/: CSS for UI (dimensional-weather.css).
- templates/: Handlebars/HTML templates used by the UI.
- lang/: Localization JSON files (en.json, es.json, fr.json, uk.json).
- campaign_settings/: Per-setting JSON plus auto-generated index.json.
- module.json: FoundryVTT manifest; updated during releases by CI.

## Build, Test, and Development Commands
- Local dev: Place this folder under Foundry’s Data/modules and enable the module in a test world. Use slash commands like "/weather update" to verify behavior.
- Generate campaign index: `node scripts/generate-campaign-settings-index.js` (run after adding/removing files in campaign_settings/).
- Release build: Create and publish a GitHub Release with a tag like `v1.2.3`. CI packages module.zip and injects version/URLs into module.json.

## Coding Style & Naming Conventions
- JavaScript ES modules with imports; 2‑space indentation; semicolons; camelCase for functions/vars; UPPER_SNAKE_CASE for constants; kebab-case filenames.
- Keep modules focused (e.g., settings, engine, UI controller). Prefer named exports.
- Update lang/*.json for user-facing text and styles/dimensional-weather.css for UI changes.

## Testing Guidelines
- No unit test framework is configured; use a Foundry test world.
- Scenarios to verify: first-run initialization, scene change auto-update, GM vs Player command permissions, time-based updates, and AI description fallback.
- Helpful flags: enable Settings → Debug options (time period, weather, settings) for logs.

## Commit & Pull Request Guidelines
- Commits: clear, imperative subject (e.g., "Fix scene init null check"). Reference issues (`#123`) when relevant.
- PRs: include a summary, before/after notes or screenshots for UI, steps to reproduce/verify, and any migration notes.
- Required checks: run the index generator if campaign_settings changed; update module.json fields only if necessary—CI injects version/URLs on release.

## Security & Configuration Tips
- Do not commit API keys. OpenAI API key is stored via module settings (Settings → Module Settings). Keep `useAI` optional and ensure graceful fallbacks.

## Quick Examples
- Regenerate index: `node scripts/generate-campaign-settings-index.js`
- Show weather: type `/weather` in chat; force update: `/weather update`; change season: `/weather season Summer`
