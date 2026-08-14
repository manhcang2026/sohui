# Sổ Hụi — Project Status

## 1. Current state

- Branch: `codex/dev`
- Checkpoint: the current repository state is the latest local commit on `codex/dev`; use `git log -1` for its exact hash.
- Working tree: **clean** after the current local checkpoint.
- Local checks: **PASS** for `npx tsc --noEmit --pretty false`, `npm run build`, and `git diff --check` on 2026-08-14.
- Production migration: historical reset passed validation 7/7; `002_p0_money_integrity.sql` is deployed on production, confirmed by the owner on 2026-08-14.
- Production deployment: deployment of the current local client/UI/API version is **not confirmed**.
- Local Supabase: `.env.local` points to **production** according to `AGENTS.md`; never use it for test writes.

## 2. Completed

- Historical ledger before `2026-08-12` is the owner-approved closed baseline; reset validation passed 7/7.
- Production schema/RLS/RPC/grants/triggers and money anomalies were audited read-only; evidence is in `audit-db/`.
- P0 migration `002_p0_money_integrity.sql` is deployed. The owner tested the local app after migration and confirmed normal operation.
- Shared lucky wheel, `PeriodResultDialog`, and `BidAmountControl` are version-controlled in the current local checkpoint in their intended result-entry flows.
- Phone/PIN login optimizations and pagination for Phiếu/Khui hôm nay are implemented.
- Lovable-derived global tokens, Be Vietnam Pro, shared UI primitives, shell/navigation, admin/member presentation, dialogs, and receipt web/JPG styling are version-controlled in the current local checkpoint.
- Receipt JPG waits for the loaded computed font; the five Dây hụi detail tabs no longer show desktop system scrollbars.
- Member portal has a specific design-system pass: responsive account header, two-column mobile stats, money hierarchy, group/performance cards, recent receipts, empty states, and a compact shared PIN dialog.
- Super Admin locally supports protected “Xóa tài khoản đăng nhập”: server-side service-role deletion, self/super-admin guards, reason and typed confirmation, double-click guard, audit attempt/result, preserved member/financial history, and list reload.
- Login-deletion retry now distinguishes a confirmed missing Auth user from Auth lookup/service failure, and legacy invalid phone values fall back safely to `XOA` confirmation.
- Member deletion preflight locally uses exact count queries for all confirmed member dependencies and never relies on an unrestricted row list.

## 3. Current business rules

- `hui_receipts` is the obligation; `receipt_payments` is actual money movement.
- Active `receipt_payments` is the source of truth for actual collected/paid money; receipt status should follow active payments.
- `receipt_date` is the obligation/period date; `transaction_date` is the money-movement date; `created_at` is technical metadata.
- Receipts/payments before `2026-08-12` are a closed historical baseline. Normal app/RPC flows must not mutate them.
- Historical `legacy_import` payments are preserved. New real-money payments from `2026-08-12` onward may use only `cash` or `transfer` in the P0 RPC.
- Preserve financial audit history through cancellation/reversal with a reason; avoid deleting payment history.
- Deleting a login account removes only Auth access and cascaded login profiles; it must preserve `members`, shares, receipts, payments, transactions, and money history.
- A `members` row may be deleted only when every business and login dependency is zero, checked atomically and fail-closed. A zero balance does not mean no history.
- A receipt cannot be cancelled while it has active payments. Period result cannot change after related active money exists without a deliberate reversal workflow.
- Normal authentication uses phone plus 4-digit PIN. Technical Auth emails must not be shown; the super-admin recovery-email path is intentional.

## 4. Production database state

- Confirmed production objects include RLS-enabled current tables, `settle_hui_period_atomic`, `register_pin_failure`, and `clear_pin_failures`.
- `002_p0_money_integrity.sql` is deployed with `money_operation_requests`, atomic money/result RPCs, support index, and financial guards.
- Confirmed protections include receipt uniqueness, payment checks/FKs, and an active source-period payment unique index.
- `app_users.auth_user_id` and `profiles.id` cascade from `auth.users`; `app_users.member_id` and legacy `profiles/receipts/transactions.member_id` use `SET NULL`; current shares/receipts restrict member deletion.
- The owner confirmed the local app works normally against production after P0 migration. This does not confirm deployment of current local files.
- `003_delete_clean_member_profile_atomic.sql` is locally hardened with a minimal `pg_catalog` search path, service-role JWT/ACL restriction, active-super-admin actor validation, parent-row locking, explicit current/legacy dependency checks, and transactional audit. It remains **review-only, not deployed**, so production member-profile deletion remains disabled.
- Production schema/RLS/RPC still contains drift not fully represented by committed migrations.
- No production account or member record was deleted or modified during this task.

## 5. Changed files in current task

- None. The P0, design-system, receipt, bid-control, member portal, Cân đối, account-safety, and status files are included in the current local checkpoint.

## 6. Open issues / next priorities

- **P0:** Signed-in visual QA for member portal, Cân đối, and Super Admin deletion dialog at mobile/tablet/desktop widths; no authenticated local browser session was available.
- **P0:** Review the hardened `003_delete_clean_member_profile_atomic.sql`; do not enable member deletion before the exact migration is approved/deployed and its future calling endpoint is separately reviewed.
- **P0:** Review and intentionally deploy the current checkpoint client/UI/API scope; do not assume it is running in production.
- **P0:** After RPC client deployment is stable, harden direct `receipt_payments` DML and exposed PIN-failure RPC execution.
- **P1:** Baseline visual pass cho Cân đối; UX cuối cùng và cấu trúc thông tin vẫn chờ chốt nghiệp vụ.
- **P1:** Reconcile/version-control remaining authoritative production schema/RLS/RPC/grants.
- **P1:** Unify obligation/status sources used by Hôm nay, Phiếu, and Cân đối.
- **P1:** Add pagination/filtering to remaining growing-table queries in Hôm nay, Dây hụi, Hụi viên, Cân đối, and member portal.

## 7. Latest task result

- User requested: create one safe local checkpoint containing the current P0, UI/design-system, receipt, member portal, Cân đối, and account-safety work.
- Changed: all intentional current files are version-controlled in one local checkpoint on `codex/dev`; `.env.local`, secrets, build output, and `tsconfig.tsbuildinfo` are excluded.
- Migration status: `002_p0_money_integrity.sql` is version-controlled and already deployed per owner confirmation; `003_delete_clean_member_profile_atomic.sql` is version-controlled for review only and remains not deployed. Member-profile deletion stays disabled and login-account deletion remains independent of migration 003.
- Typecheck: **PASS**.
- Build: **PASS**.
- Diff check: **PASS**; only Git line-ending notices.
- Verification: typecheck/build/diff checks pass. No delete request or database write was performed while creating the checkpoint.
- Migration executed: **no**.
- Database write/account deletion performed: **no / no**.
- Commit/push: **local checkpoint created / no push**.
- Remaining blocker: explicit owner review/deployment decision for migration 003, followed by a separate review of any future RPC-calling endpoint before member deletion can be enabled.

## 8. Next recommended action

1. Review the hardened migration 003 without executing it.
2. Decide the deployment scope for the current checkpoint; local commit does not imply production client deployment.
3. Only after migration 003 is explicitly approved/deployed, review a separate endpoint task before enabling member-profile deletion.

## 9. Safety constraints

- Production Supabase contains real money data; do not write, delete, seed, or migrate without explicit approval.
- Do not push or commit unless explicitly requested; never commit secrets or `.env.local`.
- Do not modify the historical baseline without a precise owner-approved operation.
- Preserve audit history and never expose credentials, tokens, PIN hashes, or technical Auth emails.
