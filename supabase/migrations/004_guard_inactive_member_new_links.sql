-- REVIEW ONLY. Do not run until the owner explicitly approves this migration.
-- Prevents new hui-share/account/profile links to suspended members while preserving
-- every existing share, receipt, payment, period, and login link.

begin;

create or replace function public.guard_active_member_for_new_link()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_is_active boolean;
begin
  if new.member_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    if new.member_id is not distinct from old.member_id then
      return new;
    end if;
  end if;

  -- FOR SHARE serializes this check with members.is_active updates. If a
  -- suspension commits first, this write fails; if this write locks first, it
  -- was created while the member was still active and suspension waits.
  select m.is_active
    into v_is_active
    from public.members m
   where m.id = new.member_id
   for share;

  if not found then
    raise exception 'member_not_found';
  end if;

  if v_is_active is distinct from true then
    raise exception 'member_inactive_for_new_business';
  end if;

  return new;
end;
$$;

revoke all on function public.guard_active_member_for_new_link()
  from public, anon, authenticated, service_role;

drop trigger if exists trg_hui_shares_require_active_member
  on public.hui_shares;
create trigger trg_hui_shares_require_active_member
before insert or update of member_id on public.hui_shares
for each row execute function public.guard_active_member_for_new_link();

drop trigger if exists trg_app_users_require_active_member
  on public.app_users;
create trigger trg_app_users_require_active_member
before insert or update of member_id on public.app_users
for each row execute function public.guard_active_member_for_new_link();

drop trigger if exists trg_profiles_require_active_member
  on public.profiles;
create trigger trg_profiles_require_active_member
before insert or update of member_id on public.profiles
for each row execute function public.guard_active_member_for_new_link();

comment on function public.guard_active_member_for_new_link()
is 'Review-only guard: blocks only new/changed hui_shares, app_users, and profiles links to inactive members; unchanged historical links remain valid.';

commit;
