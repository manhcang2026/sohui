\# Sổ Hụi — Instructions for Codex



\## Project context



This repository is the production codebase for the Sổ Hụi web application.



Tech stack:

\- Next.js 16

\- React 19

\- TypeScript

\- Supabase

\- Tailwind CSS / shadcn

\- Vercel deployment



The application manages real hui/chit-fund operations and real monetary records.



Accuracy and data safety are more important than speed.



\---



\## Production safety



The local `.env.local` currently connects to the REAL PRODUCTION Supabase database.



Therefore:



\- Do NOT create, update, delete, cancel, or otherwise mutate production data merely for testing.

\- Do NOT run destructive SQL.

\- Do NOT run migrations unless the user explicitly approves the exact migration.

\- Do NOT reset, truncate, seed, backfill, normalize, or clean production tables without explicit approval.

\- Do NOT create test payments, receipts, hui periods, members, users, or shares in production.

\- Prefer read-only inspection when diagnosing database issues.

\- If a test requires a database write, explain exactly what will be written and ask the user before doing it.



Never expose or print:

\- SUPABASE\_SERVICE\_ROLE\_KEY

\- passwords

\- access tokens

\- refresh tokens

\- secrets from `.env.local`



Never add `.env.local` or secrets to Git.



\---



\## Money and receipt model



Core business rule:



\- `hui\_receipts` represents the obligation / amount that should be collected or paid.

\- `receipt\_payments` represents actual money movement.

\- Active `receipt\_payments` are the source of truth for actual collected/paid money.

\- Receipt status should be derived from active payments whenever possible.

\- Never create duplicate payments.

\- Preserve audit history.

\- Prefer cancelling/reversing records over deleting financial history.



Important dates:



\- `receipt\_date` = hui period / receipt obligation date.

\- `transaction\_date` = actual date money moved.

\- `created\_at` = technical database creation timestamp only.



Payment methods used by the application:

\- `transfer`

\- `cash`

\- `legacy\_import`



Historical imported payments may use `legacy\_import`.



Do not convert historical imported data into current transactions without explicit approval.



\---



\## Authentication model



The app uses phone number + 4-digit PIN for normal login.



Normal users/admins may use technical Supabase Auth emails derived from their phone/account mapping.



The super admin intentionally keeps a real recovery email.



Do NOT redesign or remove this recovery path unless explicitly requested.



Do not expose technical Auth emails in the user interface.



\---



\## Git workflow



The user is developing locally on branch:



`codex/dev`



Rules:



\- Do NOT push to GitHub unless the user explicitly asks.

\- Do NOT merge into `main` unless the user explicitly asks.

\- Do NOT force push.

\- Do NOT rewrite or amend existing history unless explicitly requested.

\- Before making changes, run or inspect `git status`.

\- After changes, show a concise summary of changed files.

\- Keep changes scoped to the requested task.

\- Avoid unrelated refactors during bug fixes.



The user may create local commits as checkpoints.



A local commit is allowed only when the user asks for one.



\---



\## Before editing



For every task:



1\. Read the relevant current files first.

2\. Understand the existing behavior before changing code.

3\. Check related imports, types, callers, and data flow.

4\. Identify whether the change can affect:

&#x20;  - authentication

&#x20;  - payments

&#x20;  - receipt calculations

&#x20;  - hui period results

&#x20;  - Supabase writes

&#x20;  - mobile/desktop rendering

5\. Prefer the smallest safe change.



If a file is large, avoid replacing unrelated sections.



Do not copy an old artifact over a newer repository file.



The repository working tree is the source of truth.



\---



\## Testing requirements



After code changes, run:



```bash

npm run build



The task is not complete until the build passes, unless the build failure is unrelated and clearly documented.

Also inspect:



git diff

git status



For UI changes, provide a short manual test checklist.

For financial/payment changes, explicitly test or reason about:

zero payment

partial payment

full payment

already-paid receipt

duplicate click/retry

cancelled payment

bulk actions

legacy imported payments

Do not create production records solely to test these cases.

UI regression rules

When changing one page, avoid unintentionally changing other flows.

Pay special attention to:

Hôm nay

Dây hụi

Khui kỳ

Hụi viên

Phiếu

Cân đối

Login

Verify that shared components do not disappear from one entry point when moved to another.

The lucky wheel / random draw should be reusable from both:

the Khui kỳ flow

the Dây hụi → Nhập kết quả flow

Pagination and Supabase queries

Supabase/PostgREST queries may be limited to 1,000 rows.

Do not assume an unrestricted .select() returns the full dataset.

For tables that can grow large, use one of:

pagination

precise filtering

querying by relevant IDs/date range

Especially watch:

receipt\_payments

hui\_receipts

hui\_periods

hui\_shares

members

Financial status must never be calculated from an accidentally truncated dataset.

Code quality

Prefer:

clear TypeScript types

small reusable functions/components

explicit business rules

deterministic calculations

readable naming

Avoid:

giant unrelated rewrites

duplicated business logic

hidden side effects

silent error swallowing

unnecessary state

unnecessary network requests

When logic is shared by two screens, prefer a shared component/helper rather than maintaining two divergent implementations.

Large-file policy

Several project files have historically become very large.

When practical, move reusable logic into focused modules instead of growing a large page further.

However:

Do not refactor merely for aesthetics during an urgent bug fix.

Preserve behavior first.

Refactor only when the boundary is clear and testable.

Database changes

Before proposing SQL or schema changes:

Inspect current application expectations.

Explain why a schema change is needed.

Prefer backward-compatible migrations.

Never assume the migration history exactly matches production.

Ask the user before executing any write or migration.

When diagnosing production data, prefer one read-only query at a time.

Completion report

When finishing a coding task, report:

what was changed

which files changed

whether npm run build passed

any remaining risks

exact manual test steps

whether any database writes were performed

Never say a problem is fixed unless the relevant code path was actually inspected and validated.

