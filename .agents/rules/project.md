---
trigger: always_on
description: Project boundaries and execution discipline for QL Nghia Trang.
---
Read AGENTS.md and docs/execution/STATE.md before coding.
Follow docs/EXECUTION_PLAN.md and the current milestone acceptance criteria.
Use FastAPI, SQL Server, MinIO, React web and Flutter mobile with one API.
Preserve the existing database; never run the destructive bootstrap SQL.
Keep runtime object data under backend/runtime on the configured data drive.
Enforce domain invariants on the server; do not claim success without evidence.
Never commit secrets, customer data, media or database backups.
Always use uv for Python backend and pnpm for web frontend.
