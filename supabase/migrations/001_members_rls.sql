alter table public.members enable row level security;

revoke all on table public.members from anon;
grant select, insert, update on table public.members to authenticated;

drop policy if exists "members_authenticated_select" on public.members;
drop policy if exists "members_authenticated_insert" on public.members;
drop policy if exists "members_authenticated_update" on public.members;

create policy "members_authenticated_select"
on public.members
for select
to authenticated
using (auth.uid() is not null);

create policy "members_authenticated_insert"
on public.members
for insert
to authenticated
with check (auth.uid() is not null);

create policy "members_authenticated_update"
on public.members
for update
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);
