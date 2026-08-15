# Sổ Hụi — Project Status

## 1. Current state

- Branch: `codex/dev`
- Safe checkpoint: `b2833c4` (`Checkpoint P0 integrity and UI system updates`).
- Working tree: **dirty** with uncommitted member suspend/reactivate, active-member selection guards, login lock/unlock UX, clean-member deletion endpoint/UI, and the locally untracked migration 004 file that the owner has deployed manually.
- Local checks: **PASS** for `npx tsc --noEmit --pretty false`, `npm run build`, and `git diff --check` on 2026-08-15; the 48-hour/receipt-level helper checks remain passed.
- Production migration: historical reset passed validation 7/7; migrations `002`, `003`, and `004` are deployed on production, confirmed by the owner on 2026-08-14. Migrations 003/004 were run manually through Supabase SQL Editor.
- Production deployment: deployment of the current local client/UI/API version is **not confirmed**.
- Local Supabase: `.env.local` points to **production** according to `AGENTS.md`; never use it for test writes.

## 2. Completed

- Historical ledger before `2026-08-12` is the owner-approved closed baseline; reset validation passed 7/7.
- Production schema/RLS/RPC/grants/triggers and money anomalies were audited read-only; evidence is in `audit-db/`.
- P0 migration `002_p0_money_integrity.sql` is deployed. The owner tested the local app after migration and confirmed normal operation.
- Migrations `003_delete_clean_member_profile_atomic.sql` and `004_guard_inactive_member_new_links.sql` were run manually on production in that order with the approved SHA-256 values; the owner-provided metadata checks passed.
- Shared lucky wheel, `PeriodResultDialog`, and `BidAmountControl` are version-controlled in the current local checkpoint in their intended result-entry flows.
- Phone/PIN login optimizations and pagination for Phiếu/Khui hôm nay are implemented.
- Lovable-derived global tokens, Be Vietnam Pro, shared UI primitives, shell/navigation, admin/member presentation, dialogs, and receipt web/JPG styling are version-controlled in the current local checkpoint.
- Receipt JPG waits for the loaded computed font; the five Dây hụi detail tabs no longer show desktop system scrollbars.
- Member portal has a specific design-system pass: responsive account header, two-column mobile stats, money hierarchy, group/performance cards, recent receipts, empty states, and a compact shared PIN dialog.
- Super Admin locally supports protected “Xóa tài khoản đăng nhập”: server-side service-role deletion, self/super-admin guards, reason and typed confirmation, double-click guard, audit attempt/result, preserved member/financial history, and list reload.
- Login-deletion retry now distinguishes a confirmed missing Auth user from Auth lookup/service failure, and legacy invalid phone values fall back safely to `XOA` confirmation.
- Member deletion preflight locally uses exact count queries for all confirmed member dependencies and never relies on an unrestricted row list.
- Member suspend/reactivate is implemented locally with explicit confirmation, stale-state protection, and no automatic changes to existing shares, receipts, money history, or login status.
- New share/account-link selectors locally exclude suspended members while preserving existing inactive-member shares and account links in historical/edit views.
- The owner has successfully tested the dedicated clean-member deletion flow against production after reviewing the protected preflight/RPC path.
- Hụi viên money statistics load growing tables deterministically with pagination, use receipt-first obligations with a derived-period fallback, and calculate overdue after the exact 48-hour payment window.
- Hụi viên responsive was refined against the confirmed Lovable layout: 375/768 use one card per row, 1024 uses two cards, and 1280+ uses the five-column table. Empty contact details are condensed, tablet action buttons no longer overlap, and the personal/contact/bank detail card remains intact; financial calculations are unchanged.
- Result entry now uses one compact shared read-only `PeriodFeeSummary` in both Khui hôm nay and Dây hụi → Lịch kỳ; bid controls, validation, and atomic result RPCs are unchanged.
- Dây hụi performance summary now shows valid opened/completed winner periods, average bid for that same period set, and member performance distribution; individual/member performance formulas and detail rows are unchanged.
- Member Portal queries are scoped to the signed-in member and related IDs, paginated beyond 1,000 rows, keep all active payments for totals, and show only the 12 newest receipts. Receipt source context uses active payment `source_period_id`; legacy or unresolved rows are labeled without guessing.

## 3. Current business rules

- `hui_receipts` is the obligation; `receipt_payments` is actual money movement.
- Active `receipt_payments` is the source of truth for actual collected/paid money; receipt status should follow active payments.
- `receipt_date` is the obligation/period date; `transaction_date` is the money-movement date; `created_at` is technical metadata.
- Receipts/payments before `2026-08-12` are a closed historical baseline. Normal app/RPC flows must not mutate them.
- Historical `legacy_import` payments are preserved. New real-money payments from `2026-08-12` onward may use only `cash` or `transfer` in the P0 RPC.
- Preserve financial audit history through cancellation/reversal with a reason; avoid deleting payment history.
- Deleting a login account removes only Auth access and cascaded login profiles; it must preserve `members`, shares, receipts, payments, transactions, and money history.
- A `members` row may be deleted only when every business and login dependency is zero, checked atomically and fail-closed. A zero balance does not mean no history.
- `members.is_active = false` means suspended from new business only. Existing groups, shares, periods, receipts, payments, balances, reports, portal access links, and audit history remain visible and unchanged.
- `app_users.is_active` controls login independently. Suspending/reactivating a member never locks/unlocks login, and locking/unlocking login never changes the member profile.
- A new share or a new/changed account link may target only an active member; an existing link to a suspended member remains intact.
- A receipt cannot be cancelled while it has active payments. Period result cannot change after related active money exists without a deliberate reversal workflow.
- Hụi viên payment obligations become overdue exactly 48 hours after the actual opening timestamp: `opened_at`, then `scheduled_at`, then Vietnam `scheduled_date + opening_time`; legacy missing-time rows explicitly fall back to 19:00 Asia/Ho_Chi_Minh.
- Hụi viên cash-flow badge uses only `active collect payments - active pay payments`. Levels are: `> 0` Tốt; `0` through `-9,999,999` Bình thường; `-10,000,000` through `-29,999,999` Cần chú ý; `-30,000,000` through `-49,999,999` Rủi ro cao; `<= -50,000,000` Báo động.
- Overdue obligations, won shares, and future obligations are shown independently and never raise the cash-flow badge.
- A valid performance period is `opened` or `completed` and has `winner_share_id`. Member Portal progress and its “Tạm tính đến hết kỳ x/y” label use exactly this same set; `y` is the actual number of scheduled period rows for the group.
- Recent Member Portal receipts identify group/period only through active `receipt_payments.source_period_id` → `hui_periods` → `hui_groups`. Multiple or mixed sources are shown as a consolidated receipt; missing/unresolved provenance is explicitly labeled as historical unknown data.
- Normal authentication uses phone plus 4-digit PIN. Technical Auth emails must not be shown; the super-admin recovery-email path is intentional.

## 4. Production database state

- Confirmed production objects include RLS-enabled current tables, `settle_hui_period_atomic`, `register_pin_failure`, and `clear_pin_failures`.
- `002_p0_money_integrity.sql` is deployed with `money_operation_requests`, atomic money/result RPCs, support index, and financial guards.
- Confirmed protections include receipt uniqueness, payment checks/FKs, and an active source-period payment unique index.
- `app_users.auth_user_id` and `profiles.id` cascade from `auth.users`; `app_users.member_id` and legacy `profiles/receipts/transactions.member_id` use `SET NULL`; current shares/receipts restrict member deletion.
- The owner confirmed the local app works normally against production after P0 migration. This does not confirm deployment of current local files.
- `003_delete_clean_member_profile_atomic.sql` was deployed manually on production on 2026-08-14 with approved SHA-256 `FA4A337D60A1090CB21AD7A3E4215C7ED3A8E53DE2313A056AFCCDA2F927D148`. Owner-provided metadata confirms the RPC is `SECURITY DEFINER`, uses `search_path=pg_catalog`, and grants EXECUTE only to `service_role`. A server-only calling endpoint and Super Admin UI now exist locally but are not confirmed deployed; the RPC was not called during implementation.
- `004_guard_inactive_member_new_links.sql` was deployed manually on production on 2026-08-14 with approved SHA-256 `ACBEA5DAB248B57D58D035F10E13695B1C44CC3D1C19D30CC0CC75D0EDDB09DE`. Owner-provided metadata confirms its `SECURITY DEFINER` trigger function uses `search_path=pg_catalog`, has no direct EXECUTE for `anon`, `authenticated`, or `service_role`, and all three triggers are enabled on `hui_shares`, `app_users`, and legacy `profiles`.
- The database guard from migration 004 is active for new/changed member links. Existing historical links remain untouched.
- Because migrations 003/004 were run manually through SQL Editor, Supabase CLI migration history may not reflect their deployment.
- Production schema/RLS/RPC still contains drift not fully represented by committed migrations.
- According to the owner, no production account, member profile, or money data was deleted or modified during deployment; only the approved function/trigger schema objects were installed.
- The owner confirmed the clean-member deletion flow was tested successfully. Codex did not call the deletion endpoint or RPC.

## 5. Changed files in current task

- `components/period-fee-summary.tsx` — new compact shared read-only “Tiền thảo” row.
- `components/period-result-dialog.tsx` — uses the shared fee row in Dây hụi → Lịch kỳ result entry.
- `components/pages/khui-hom-nay.tsx` — uses the same shared fee row in Khui hôm nay.
- `components/pages/day-hui.tsx` — full responsive locked-group warning text; earlier active-member safeguards remain preserved.
- `components/hui-performance-view.tsx` — replaces three group-level summary cards with useful period/bid/distribution KPIs.
- `lib/hui-performance.ts` — exposes the existing valid-period selection so summary and portal labels use the same set; calculation behavior is unchanged.
- `components/pages/member-portal.tsx` — scoped paginated loading, exact period progress, and exact/aggregate/legacy receipt provenance.
- `PROJECT_STATUS.md` — reflects the current task and verified results.
- Other pre-existing dirty files remain intact: `app/api/admin/users/route.ts`, `app/page.tsx`, `components/account/account-security.tsx`, `components/pages/hui-vien.tsx`, `components/pages/hui-vien-financials.ts`, `app/api/admin/members/`, and `supabase/migrations/004_guard_inactive_member_new_links.sql`.

## 6. Open issues / next priorities

- **P0:** Signed-in visual QA remains for Member Portal, Cân đối, and the Super Admin deletion dialog. The current browser session is an admin session, so Member Portal was not impersonated or re-authenticated merely for testing.
- **P0:** Review and intentionally deploy the current checkpoint client/UI/API scope; do not assume it is running in production.
- **P0:** After RPC client deployment is stable, harden direct `receipt_payments` DML and exposed PIN-failure RPC execution.
- **P1:** Correct Cân đối pagination and member-level cross-receipt netting; it still has the same growing-table and source-of-truth risk removed from Hụi viên.
- **P1:** Baseline visual pass cho Cân đối; UX cuối cùng và cấu trúc thông tin vẫn chờ chốt nghiệp vụ.
- **P1:** Reconcile/version-control remaining authoritative production schema/RLS/RPC/grants.
- **P1:** Unify obligation/status sources used by Hôm nay, Phiếu, and Cân đối.
- **P1:** Add pagination/filtering to remaining growing-table queries in Dây hụi and Cân đối; Hụi viên, Khui hôm nay, and Member Portal are paginated/scoped.

## 7. Latest task result

- User requested: compact result-entry fee display, repair the locked-group warning, replace unhelpful group KPIs, and add exact progress/provenance plus safe pagination to Member Portal.
- Changed: both live result-entry paths use one 44px shared fee row; the full warning wraps naturally; group KPIs are valid-period count, average bid, and member performance distribution; Member Portal uses the same valid-period set for progress and labels receipt provenance only from active payment source links.
- Member Portal data safety: member receipts and own shares are filtered server-side; related groups/shares/periods/payments are queried only by derived IDs in bounded batches and paginated. Totals use every active payment loaded for all member receipts; only display is sliced to 12 recent receipts.
- Visual QA: direct PASS for the fee row, warning, and KPI cards at `375×812`, `768×1024`, `1024×768`, and `1280×800`, with no page-level horizontal overflow. Khui hôm nay had zero eligible groups on 2026-08-15, so its open dialog was verified through the identical shared component/code path rather than a live write-capable flow. Member Portal visual QA remains pending because the active session is admin; no logout, impersonation, or account switch was performed.
- Preserved: `BidAmountControl`, result validation/RPC calls, locked financial-result behavior, individual performance calculations/details, receipt amounts/statuses, and all pre-existing dirty work.
- Typecheck/build/diff check: **PASS**.
- Migration executed / database write by Codex: **no / no**.
- Commit/push: **no / no**.
- Remaining blocker: signed-in Member Portal visual QA and deployment of the current local client are not confirmed.

## 8. Next recommended action

1. Owner checks Member Portal using a real member session, including progress text and recent single/aggregate/legacy receipts, without submitting any write action.
2. Review and intentionally deploy the current local client scope; do not assume it is already production-deployed.
3. Correct Cân đối pagination and receipt-level remaining calculations in a separately reviewed task.

## 9. Safety constraints

- Production Supabase contains real money data; do not write, delete, seed, or migrate without explicit approval.
- Do not push or commit unless explicitly requested; never commit secrets or `.env.local`.
- Do not modify the historical baseline without a precise owner-approved operation.
- Preserve audit history and never expose credentials, tokens, PIN hashes, or technical Auth emails.
