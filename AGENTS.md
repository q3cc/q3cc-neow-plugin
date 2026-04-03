# Repository Guidelines

## Project Structure & Module Organization
- Root modules:
  - `index.js`: barrel entry that re-exports both plugins for external loading.
  - `meow_user_info.js`: shared account state, favor tiers, stamina recovery, `/nhelp` (`/neowhelp` alias), `/ping`, `/my`, and `/24g sign`.
  - `meow_game_24.js`: `/24g` menu, difficulty settings, game lifecycle, solver, and rewards.
  - `SPEC.md`: behavior contract for commands, favor, stamina, and 24-point rules.
- Keep shared state and profile logic in `meow_user_info.js`; keep game-only logic in `meow_game_24.js`. Add tests under `tests/` if you introduce them.

## Build, Test, and Development Commands
- No standalone build system is bundled here.
- Run syntax checks before submitting:
  - `node --check meow_user_info.js`
  - `node --check meow_game_24.js`
- Manually verify the bot flows after edits: `/nhelp`, `/my`, `/24g`, `/24g difficulty`, `/24g start`, `/24g answer ...`, and `/24g sign`.

## Coding Style & Naming Conventions
- Follow the existing ES module style: 2-space indentation, no semicolons, camelCase methods, PascalCase plugin classes.
- Keep reply text short, Chinese-first, and consistent with the current “大喵喵 / meow” tone.
- Reuse exported helpers such as `getUserData`, `syncUserData`, and `buildUserInfoLines` instead of duplicating account logic.

## Testing Guidelines
- Automated tests are not present yet; add them for new public helpers or solver/state logic.
- Recommended layout: `tests/*.test.js`.
- Focus on favor tier thresholds, stamina recovery/caps, daily sign-in limits, multi-user game isolation, and formula validation edge cases.
- At minimum, run the two syntax checks and exercise both yes/no and formula-answer paths in a bot sandbox.

## Commit & Pull Request Guidelines
- This snapshot has no `.git` metadata, so use short imperative commits with scope, for example: `feat: adjust 24g reward ranges`.
- PRs should summarize gameplay impact, list changed commands, and include sample chat output when reply text or menus change.

## Security & Configuration Tips
- Do not commit real QQ IDs, group IDs, tokens, or personal data.
- Keep user-state mutations centralized so stamina caps and favor locks stay consistent.
- If you add configurable values, document defaults in `SPEC.md` and avoid scattering magic numbers across both plugins.
