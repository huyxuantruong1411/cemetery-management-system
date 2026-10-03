---
name: cemetery-domain
description: Use when implementing or reviewing cemetery contracts, plots, burial, exhumation, transfer, care, or finance.
---
# Cemetery Domain Invariants & Rules

1. **Context & Foundation:**
   - Read `docs/EXECUTION_PLAN.md` sections 2, 5, 6 and relevant ADRs.
   - Respect 4 contract types: `LAND_PURCHASE`, `EXHUMATION`, `CREMATION`, `TRANSFER`. Burial is an annex `BURIAL`.

2. **Invariants Checklist:**
   - **Kim Tĩnh Immutability:** Once Kim Tinh burial is completed, the plot is permanently locked at DB and service layers. Reject exhumation, structural modifications, transfer, and flag alteration.
   - **Anti-double booking:** Plot reservation is required during contract drafting. Two simultaneous reservation requests on the same empty plot must yield 1 success and 1 `409 Conflict`.
   - **Ownership Chain:** Preserve prior ownership history upon land transfer. Former owners cannot exercise rights over transferred plots.
   - **Death Certificate Verification:** Burial annexes cannot be activated without a verified death certificate (`is_verified = 1`, `verified_by` recorded).
   - **Financial Precision:** Currency in `DECIMAL(15,2)` and Python `Decimal`. Idempotency key required for all payment creations.
   - **Slot Occupancy:** 1 deceased person cannot be buried concurrently in 2 slots. An empty slot after exhumation does not change the plot to empty if other slots are occupied.

3. **Verification:**
   - Write unit and integration tests covering happy path, rejection branches, and concurrency.
   - Record unresolved conflicts or edge cases in `docs/execution/STATE.md`.
