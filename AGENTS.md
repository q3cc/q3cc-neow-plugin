# Repository Guidelines

## Project Structure & Module Organization
- Root modules:
  - `index.js`: plugin entry that loads files from `apps/`.
  - `apps/neow.js`: the active Yunzai plugin class and command routing.
  - `utils/user-data.js`: shared account state, favor tiers, stamina recovery, `/nhelp` text, `/ping`, `/my`, and sign-in helpers.
  - `utils/game24.js`: 24-point difficulty config, question-bank routing, anti-cheat reward logic, and game key helpers.
  - `utils/ml-game.js`: password game rules, history formatting, and reward logic.
  - `resources/game24-bank-*.json`: 24-point question banks; do not hand-edit generated entries unless necessary.
  - `scripts/generate-game24-bank.mjs`: generates a single 24-point bank at a time.
  - `SPEC.md`: behavior contract for commands, favor, stamina, and 24-point rules.
- Keep plugin entry logic in `apps/` and reusable state/game helpers in `utils/`. Add tests under `tests/` if you introduce them.

## Build, Test, and Development Commands
- No standalone build system is bundled here.
- Run syntax checks before submitting:
  - `node --check index.js`
  - `node --check apps/neow.js`
  - `node --check utils/user-data.js`
  - `node --check utils/game24.js`
  - `node --check utils/ml-game.js`
  - `node --check scripts/generate-game24-bank.mjs`
- Manually verify the bot flows after edits: `/nhelp`, `/my`, `/sign`, `/24g`, `/24g difficulty`, `/24g start`, and `/24g answer ...`.

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
- Use Chinese commit messages and keep them specific, for example: `优化24点题库与密码破译规则`.
- Commit titles and bodies must match the actual staged diff of the current task; never reuse unrelated historical example content as the real commit message.
- If the user says a commit is only a “示例 commit”, treat it as a format reference unless they explicitly ask to use that exact title/body.
- Prefer commit messages in this structure: one concise Chinese title, plus a body with specific bullet-style lines such as `[优化] ...`、`[修复] ...`、`[维护] ...`、`[文档] ...`, and every line must correspond to the current commit.
- Every user-visible change must be reflected in `CHANGELOG.md` with detailed bullet logs. Prefer explicit entries such as `[优化] 猜密码游戏每个数字现在不会重复` and `[优化] 现在使用题库进行提升速度`.
- Stage only task-related files with explicit paths. Never include temporary references like `1.txt`.
- PRs should summarize gameplay impact, list changed commands, and include sample chat output when reply text or menus change.

## Security & Configuration Tips
- Do not commit real QQ IDs, group IDs, tokens, or personal data.
- Keep user-state mutations centralized so stamina caps and favor locks stay consistent.
- If you add configurable values, document defaults in `SPEC.md` and avoid scattering magic numbers across both plugins.
