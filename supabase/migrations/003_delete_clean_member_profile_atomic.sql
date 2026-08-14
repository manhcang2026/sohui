-- REVIEW ONLY. Do not run until the owner explicitly approves this migration.
-- Deletes only a completely unused member profile and fails closed inside one
-- database transaction before any ON DELETE SET NULL relationship can fire.

create or replace function public.delete_clean_member_profile_atomic(
  p_member_id uuid,
  p_reason text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_member public.members%rowtype;
  v_actor_role public.app_role;
  v_counts jsonb;
begin
  -- This RPC is intentionally server-only. p_actor_id is accepted only after
  -- PostgREST confirms the caller carries the service_role JWT; the actor row
  -- must still identify an active super admin below.
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'service_role_required';
  end if;

  if p_member_id is null then
    raise exception 'member_id_required';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'delete_reason_required';
  end if;

  select role
    into v_actor_role
    from public.app_users
   where auth_user_id = p_actor_id
     and is_active = true;

  if v_actor_role is distinct from 'super_admin'::public.app_role then
    raise exception 'super_admin_required';
  end if;

  select *
    into v_member
    from public.members
   where id = p_member_id
   for update;

  if not found then
    raise exception 'member_not_found';
  end if;

  -- The parent-row FOR UPDATE lock conflicts with the KEY SHARE lock taken by
  -- every current FK insert that references members(id). Concurrent inserts
  -- therefore either commit before these checks (and are seen here) or wait
  -- until this transaction deletes the member, then fail their FK check.
  -- receipt_payments is indirect: an existing hui_receipts row already blocks
  -- deletion, while a new receipt must first pass the locked members FK.

  select jsonb_build_object(
    'hui_shares', (select count(*) from public.hui_shares where member_id = p_member_id),
    'hui_receipts', (select count(*) from public.hui_receipts where member_id = p_member_id),
    'receipt_payments', (
      select count(*)
        from public.receipt_payments rp
        join public.hui_receipts hr on hr.id = rp.receipt_id
       where hr.member_id = p_member_id
    ),
    'receipts', (select count(*) from public.receipts where member_id = p_member_id),
    'transactions', (select count(*) from public.transactions where member_id = p_member_id),
    'app_users', (select count(*) from public.app_users where member_id = p_member_id),
    'profiles', (select count(*) from public.profiles where member_id = p_member_id)
  ) into v_counts;

  if exists (select 1 from public.hui_shares where member_id = p_member_id)
     or exists (select 1 from public.hui_receipts where member_id = p_member_id)
     or exists (
       select 1
         from public.receipt_payments rp
         join public.hui_receipts hr on hr.id = rp.receipt_id
        where hr.member_id = p_member_id
     )
     or exists (select 1 from public.receipts where member_id = p_member_id)
     or exists (select 1 from public.transactions where member_id = p_member_id)
     or exists (select 1 from public.app_users where member_id = p_member_id)
     or exists (select 1 from public.profiles where member_id = p_member_id) then
    raise exception 'member_has_dependencies'
      using detail = v_counts::text;
  end if;

  insert into public.audit_logs (
    entity_type,
    entity_id,
    action,
    before_data,
    after_data,
    reason,
    actor_id
  ) values (
    'member',
    p_member_id::text,
    'delete_clean_member_profile',
    to_jsonb(v_member),
    jsonb_build_object('status', 'deleted', 'dependency_counts', v_counts),
    trim(p_reason),
    p_actor_id
  );

  delete from public.members where id = p_member_id;

  return jsonb_build_object(
    'ok', true,
    'member_id', p_member_id,
    'dependency_counts', v_counts
  );
end;
$$;

revoke all on function public.delete_clean_member_profile_atomic(uuid, text, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.delete_clean_member_profile_atomic(uuid, text, uuid)
  to service_role;

comment on function public.delete_clean_member_profile_atomic(uuid, text, uuid)
is 'Service-role-only atomic deletion of a completely unused members row after fail-closed dependency checks.';
