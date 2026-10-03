---
name: milestone-delivery
description: Use when wrapping up, validating, or delivering any milestone M00-M14.
---
# Milestone Delivery & Verification Checklist

1. **Pre-delivery Quality Gates:**
   - Backend checks: `uv run ruff check .`, `uv run pytest`.
   - Web checks: `pnpm lint`, `pnpm build`.
   - Mobile checks: `flutter analyze`, `flutter test`.
   - No untracked runtime files (`backend/runtime/`, `.env`, build artifacts) staged in Git.

2. **Evidence & Documentation:**
   - Update `docs/execution/STATE.md` with:
     - Completed tasks and current milestone status.
     - Exact test commands executed and results obtained.
     - Known limitations or open decisions.
   - If UI was created/modified, record screenshot evidence in `docs/evidence/Mxx/`.
   - Update `CHANGELOG.md` with Added, Changed, Fixed, DB migrations.

3. **Git Hygiene:**
   - Commit with Conventional Commits format (e.g., `feat(contracts): activate signed land purchase contracts`).
   - Create annotated Git tag only after all gate conditions pass (e.g., `git tag -a v0.1.0-baseline -m "M00 accepted"`).
