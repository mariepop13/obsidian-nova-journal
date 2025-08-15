- Utiliser les agents spécialisés selon le master-agent.md

 ---
description: "Clean Code — User Rules (Language-agnostic)"
alwaysApply: true
---

- Naming
  - Use clear, intention-revealing names; avoid abbreviations and cleverness.
  - Functions/methods use verb phrases; variables/constants use nouns.
  - Extract complex conditions into well-named booleans; avoid magic numbers (use named constants).

- Functions and structure
  - Single responsibility; small and focused (aim for ~20–40 lines).
  - Prefer early returns (guard clauses); keep nesting ≤ 2 levels.
  - ≤ 3–4 parameters; otherwise group into an object/record/struct.
  - Keep modules cohesive; avoid circular dependencies.

- Control flow
  - Handle errors and edge cases first; keep the happy path obvious.
  - Avoid deep else-chains; consider lookup tables/strategy when clearer.
  - Favor straightforward logic over clever tricks.

- Types and contracts
  - Make public APIs explicit and stable; document inputs/outputs.
  - Validate external inputs at boundaries; fail fast with clear messages.
  - Prefer immutability for shared data; avoid mutating inputs.

- Errors and logging
  - Never swallow errors; propagate or handle meaningfully.
  - Log actionable context (who/what/where), not noise; no debug logs in hot paths.
  - Use levels consistently; no sensitive data in logs.

- Comments and documentation
  - Explain the “why,” not the “what.” Remove redundant comments.
  - No commented-out or dead code; delete it.
  - Use concise API docs for non-trivial functions and public interfaces.

- Formatting and layout
  - Consistent indentation (2 or 4 spaces) and style across the project.
  - Keep lines reasonably short (≤ 100–120 chars); wrap long expressions.
  - Prefer multi-line over complex one-liners/ternaries.
  - Order imports/dependencies: standard → third-party → internal; group and sort.

- Data and side effects
  - Prefer pure functions; isolate side effects (I/O, network, time).
  - Inject external dependencies for testability; avoid hidden globals/singletons.
  - Be explicit about mutation and shared state; minimize it.

- Performance
  - Readability over premature optimization; optimize only with measurements.
  - Avoid needless allocations/work in hot loops; cache thoughtfully with invalidation.

- Testing
  - Test non-trivial logic: happy path + edge cases + failure modes.
  - Make tests readable (arrange/act/assert) with descriptive names.
  - Keep unit tests fast and deterministic; isolate external systems.

- Tooling and quality gates
  - Follow the project’s linter/formatter; fix warnings before PR.
  - If a rule conflicts with the linter, follow the linter and surface the gap.
  - Keep dependencies minimal, up-to-date, and justified.

- Refactoring and commits
  - Prefer small, safe, atomic edits; run tests frequently.
  - Remove duplication (DRY) without over-abstracting (rule of three).
  - No TODOs left in code; implement or track with an issue.

- File size and structure
  - Keep files small and cohesive: target ≤ 200–400 lines; if > 400, consider splitting.
  - One main responsibility per file; avoid “God files”.
  - Limit exports per file to 1–3 closely related entities.
  - Separate layers (UI, domain, data/infrastructure) into different files/modules.
  - Tests may be larger, but keep each suite focused and readable (clear arrange/act/assert).
- Toujours npm test et npm run buil après un changement