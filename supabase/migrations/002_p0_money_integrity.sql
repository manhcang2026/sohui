begin;

create table if not exists public.money_operation_requests (
  idempotency_key uuid primary key,
  operation text not null,
  request_hash text not null,
  result_json jsonb,
  actor_id uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.money_operation_requests enable row level security;
revoke all on table public.money_operation_requests from public, anon, authenticated;

create index if not exists receipt_payments_active_receipt_idx
on public.receipt_payments (receipt_id)
where status = 'active';

create or replace function public.recompute_receipt_status_private(
  p_receipt_id uuid
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_receipt public.hui_receipts%rowtype;
  v_net numeric;
  v_direction text;
  v_paid numeric;
  v_status text;
begin
  select * into v_receipt
  from public.hui_receipts
  where id = p_receipt_id
  for update;

  if not found then
    raise exception 'receipt_not_found';
  end if;

  v_net := v_receipt.source_total_pay
    - v_receipt.source_total_receive
    + v_receipt.settlement_amount;

  if v_net = 0 then
    if exists (
      select 1 from public.receipt_payments
      where receipt_id = p_receipt_id and status = 'active'
    ) then
      raise exception 'active_payment_for_zero_obligation';
    end if;
    v_status := 'open';
  else
    v_direction := case when v_net > 0 then 'collect' else 'pay' end;

    if exists (
      select 1 from public.receipt_payments
      where receipt_id = p_receipt_id
        and status = 'active'
        and direction <> v_direction
    ) then
      raise exception 'active_payment_wrong_direction';
    end if;

    select coalesce(sum(amount), 0) into v_paid
    from public.receipt_payments
    where receipt_id = p_receipt_id
      and status = 'active'
      and direction = v_direction;

    if v_paid > abs(v_net) then
      raise exception 'active_payment_exceeds_obligation';
    end if;

    v_status := case
      when v_paid = 0 then 'open'
      when v_paid < abs(v_net) then 'partial'
      else 'paid'
    end;
  end if;

  update public.hui_receipts
  set status = v_status, updated_at = now()
  where id = p_receipt_id;

  return v_status;
end;
$function$;

revoke all on function public.recompute_receipt_status_private(uuid)
from public, anon, authenticated;

create or replace function public.record_receipt_payment_atomic(
  p_idempotency_key uuid,
  p_items jsonb,
  p_method text,
  p_transaction_date date,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_role public.app_role;
  v_actor uuid := auth.uid();
  v_request_hash text;
  v_operation public.money_operation_requests%rowtype;
  v_item jsonb;
  v_receipt public.hui_receipts%rowtype;
  v_payment public.receipt_payments%rowtype;
  v_member_id uuid;
  v_receipt_date date;
  v_existing_payment_id uuid;
  v_source_period_id uuid;
  v_payload_pay numeric;
  v_payload_receive numeric;
  v_payload_fee numeric;
  v_requested numeric;
  v_net numeric;
  v_direction text;
  v_other_paid numeric;
  v_remaining numeric;
  v_amount numeric;
  v_status text;
  v_results jsonb := '[]'::jsonb;
  v_result jsonb;
begin
  select public.current_app_role() into v_role;
  if v_role not in ('admin'::public.app_role, 'super_admin'::public.app_role) then
    raise exception 'forbidden';
  end if;

  if p_idempotency_key is null then raise exception 'idempotency_key_required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'items_must_be_non_empty_array';
  end if;
  if p_method not in ('cash', 'transfer') then
    raise exception 'invalid_payment_method';
  end if;
  if p_transaction_date is null then raise exception 'transaction_date_required'; end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    group by item->>'member_id', item->>'receipt_date'
    having count(*) > 1
  ) then
    raise exception 'duplicate_receipt_in_request';
  end if;

  v_request_hash := md5(jsonb_build_object(
    'items', p_items,
    'method', p_method,
    'transaction_date', p_transaction_date,
    'note', nullif(btrim(coalesce(p_note, '')), '')
  )::text);

  insert into public.money_operation_requests (
    idempotency_key, operation, request_hash, actor_id
  ) values (
    p_idempotency_key, 'record_receipt_payment', v_request_hash, v_actor
  ) on conflict (idempotency_key) do nothing;

  select * into v_operation
  from public.money_operation_requests
  where idempotency_key = p_idempotency_key
  for update;

  if v_operation.operation <> 'record_receipt_payment'
     or v_operation.request_hash <> v_request_hash then
    raise exception 'idempotency_key_payload_mismatch';
  end if;
  if v_operation.actor_id is distinct from v_actor then
    raise exception 'idempotency_key_owner_mismatch';
  end if;

  if v_operation.result_json is not null then
    return v_operation.result_json;
  end if;

  -- Pass 1: create missing receipts only; existing snapshots are never overwritten.
  -- Input order is normalized to keep lock acquisition deterministic.
  for v_item in
    select item
    from jsonb_array_elements(p_items) item
    order by item->>'member_id', item->>'receipt_date'
  loop
    begin
      v_member_id := (v_item->>'member_id')::uuid;
      v_receipt_date := (v_item->>'receipt_date')::date;
      v_payload_pay := (v_item->>'source_total_pay')::numeric;
      v_payload_receive := (v_item->>'source_total_receive')::numeric;
      v_payload_fee := (v_item->>'source_total_fee')::numeric;
    exception when others then
      raise exception 'invalid_item_payload';
    end;

    if v_receipt_date < date '2026-08-12' then
      raise exception 'historical_receipt_immutable';
    end if;
    if v_payload_pay < 0 or v_payload_receive < 0 or v_payload_fee < 0 then
      raise exception 'negative_receipt_snapshot';
    end if;

    insert into public.hui_receipts (
      member_id,
      receipt_date,
      source_total_pay,
      source_total_receive,
      source_total_fee,
      source_total_profit,
      status,
      updated_at
    ) values (
      v_member_id,
      v_receipt_date,
      v_payload_pay,
      v_payload_receive,
      v_payload_fee,
      0,
      'open',
      now()
    ) on conflict (member_id, receipt_date) do nothing;
  end loop;

  -- Lock every target receipt in stable UUID order before remaining calculations.
  perform r.id
  from public.hui_receipts r
  join (
    select distinct
      (item->>'member_id')::uuid as member_id,
      (item->>'receipt_date')::date as receipt_date
    from jsonb_array_elements(p_items) item
  ) requested
    on requested.member_id = r.member_id
   and requested.receipt_date = r.receipt_date
  order by r.id
  for update of r;

  -- Pass 2: validate locked DB snapshots, then record/edit payments.
  for v_item in
    select item
    from jsonb_array_elements(p_items) item
    order by item->>'member_id', item->>'receipt_date'
  loop
    v_member_id := (v_item->>'member_id')::uuid;
    v_receipt_date := (v_item->>'receipt_date')::date;
    v_payload_pay := (v_item->>'source_total_pay')::numeric;
    v_payload_receive := (v_item->>'source_total_receive')::numeric;
    v_payload_fee := (v_item->>'source_total_fee')::numeric;
    v_existing_payment_id := nullif(v_item->>'existing_payment_id', '')::uuid;
    v_source_period_id := nullif(v_item->>'source_period_id', '')::uuid;
    v_requested := nullif(v_item->>'requested_amount', '')::numeric;

    select * into strict v_receipt
    from public.hui_receipts
    where member_id = v_member_id and receipt_date = v_receipt_date;

    if v_receipt.receipt_date < date '2026-08-12' then
      raise exception 'historical_receipt_immutable';
    end if;
    if v_receipt.status = 'cancelled' then raise exception 'receipt_cancelled'; end if;

    if v_receipt.source_total_pay <> v_payload_pay
       or v_receipt.source_total_receive <> v_payload_receive
       or v_receipt.source_total_fee <> v_payload_fee then
      raise exception 'stale_snapshot';
    end if;

    v_net := v_receipt.source_total_pay
      - v_receipt.source_total_receive
      + v_receipt.settlement_amount;
    if v_net = 0 then raise exception 'zero_receipt_obligation'; end if;
    v_direction := case when v_net > 0 then 'collect' else 'pay' end;

    if v_source_period_id is not null and not exists (
      select 1
      from public.hui_periods hp
      join public.hui_shares hs
        on hs.group_id = hp.group_id and hs.member_id = v_receipt.member_id
      where hp.id = v_source_period_id
        and hp.scheduled_date = v_receipt.receipt_date
    ) then
      raise exception 'source_period_not_related_to_receipt';
    end if;

    if v_existing_payment_id is not null then
      select * into v_payment
      from public.receipt_payments
      where id = v_existing_payment_id
      for update;
      if not found or v_payment.receipt_id <> v_receipt.id then
        raise exception 'payment_not_found_for_receipt';
      end if;
      if v_payment.status <> 'active' then raise exception 'payment_not_active'; end if;
      if v_source_period_id is distinct from v_payment.source_period_id then
        raise exception 'source_period_cannot_change';
      end if;
    end if;

    if exists (
      select 1 from public.receipt_payments
      where receipt_id = v_receipt.id
        and status = 'active'
        and direction <> v_direction
        and (v_existing_payment_id is null or id <> v_existing_payment_id)
    ) then
      raise exception 'active_payment_wrong_direction';
    end if;

    select coalesce(sum(amount), 0) into v_other_paid
    from public.receipt_payments
    where receipt_id = v_receipt.id
      and status = 'active'
      and direction = v_direction
      and (v_existing_payment_id is null or id <> v_existing_payment_id);

    v_remaining := abs(v_net) - v_other_paid;
    if v_remaining <= 0 then raise exception 'receipt_already_paid'; end if;
    v_amount := coalesce(v_requested, v_remaining);
    if v_amount <= 0 then raise exception 'payment_amount_must_be_positive'; end if;
    if v_amount > v_remaining then raise exception 'payment_exceeds_remaining'; end if;

    if v_existing_payment_id is null then
      insert into public.receipt_payments (
        receipt_id, direction, amount, method, note, status,
        source_period_id, transaction_date, created_at, updated_at
      ) values (
        v_receipt.id, v_direction, v_amount, p_method,
        nullif(btrim(coalesce(p_note, '')), ''), 'active',
        v_source_period_id, p_transaction_date, now(), now()
      ) returning * into v_payment;
    else
      update public.receipt_payments
      set direction = v_direction,
          amount = v_amount,
          method = p_method,
          note = nullif(btrim(coalesce(p_note, '')), ''),
          transaction_date = p_transaction_date,
          updated_at = now()
      where id = v_existing_payment_id
      returning * into v_payment;
    end if;

    v_status := public.recompute_receipt_status_private(v_receipt.id);

    insert into public.audit_logs (
      entity_type, entity_id, action, after_data, reason, actor_id
    ) values (
      'payment',
      v_payment.id::text,
      case when v_existing_payment_id is null then 'record_atomic' else 'edit_atomic' end,
      jsonb_build_object(
        'receipt_id', v_receipt.id,
        'amount', v_payment.amount,
        'direction', v_payment.direction,
        'method', v_payment.method,
        'transaction_date', v_payment.transaction_date,
        'receipt_status', v_status,
        'idempotency_key', p_idempotency_key
      ),
      case when v_existing_payment_id is null
        then 'Ghi nhận thu/chi atomic'
        else 'Sửa giao dịch thu/chi atomic'
      end,
      v_actor
    );

    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'receipt_id', v_receipt.id,
      'payment_id', v_payment.id,
      'amount', v_payment.amount,
      'direction', v_payment.direction,
      'receipt_status', v_status
    ));
  end loop;

  update public.money_operation_requests
  set result_json = jsonb_build_object(
        'ok', true,
        'idempotency_key', p_idempotency_key,
        'payments', v_results
      ),
      completed_at = now()
  where idempotency_key = p_idempotency_key
  returning result_json into v_result;

  return v_result;
end;
$function$;

create or replace function public.cancel_receipt_payment_atomic(
  p_payment_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_role public.app_role;
  v_actor uuid := auth.uid();
  v_receipt_id uuid;
  v_receipt public.hui_receipts%rowtype;
  v_payment public.receipt_payments%rowtype;
  v_status text;
begin
  select public.current_app_role() into v_role;
  if v_role not in ('admin'::public.app_role, 'super_admin'::public.app_role) then
    raise exception 'forbidden';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'cancel_reason_required';
  end if;

  select receipt_id into v_receipt_id
  from public.receipt_payments where id = p_payment_id;
  if v_receipt_id is null then raise exception 'payment_not_found'; end if;

  select * into v_receipt from public.hui_receipts
  where id = v_receipt_id for update;
  if v_receipt.receipt_date < date '2026-08-12' then
    raise exception 'historical_receipt_immutable';
  end if;

  select * into v_payment from public.receipt_payments
  where id = p_payment_id for update;
  if not found or v_payment.receipt_id <> v_receipt.id then
    raise exception 'payment_not_found';
  end if;

  if v_payment.status = 'cancelled' then
    return jsonb_build_object(
      'ok', true, 'payment_id', v_payment.id,
      'receipt_id', v_receipt.id, 'already_cancelled', true,
      'receipt_status', v_receipt.status
    );
  end if;

  update public.receipt_payments
  set status = 'cancelled', cancelled_at = now(),
      cancel_reason = btrim(p_reason), updated_at = now()
  where id = p_payment_id;

  v_status := public.recompute_receipt_status_private(v_receipt.id);

  insert into public.audit_logs (
    entity_type, entity_id, action, before_data, after_data, reason, actor_id
  ) values (
    'payment', v_payment.id::text, 'cancel_atomic', to_jsonb(v_payment),
    jsonb_build_object('status', 'cancelled', 'receipt_status', v_status),
    btrim(p_reason), v_actor
  );

  return jsonb_build_object(
    'ok', true, 'payment_id', v_payment.id,
    'receipt_id', v_receipt.id, 'receipt_status', v_status
  );
end;
$function$;

create or replace function public.cancel_receipt_atomic(
  p_receipt_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_role public.app_role;
  v_actor uuid := auth.uid();
  v_receipt public.hui_receipts%rowtype;
begin
  select public.current_app_role() into v_role;
  if v_role not in ('admin'::public.app_role, 'super_admin'::public.app_role) then
    raise exception 'forbidden';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'cancel_reason_required';
  end if;

  select * into v_receipt from public.hui_receipts
  where id = p_receipt_id for update;
  if not found then raise exception 'receipt_not_found'; end if;
  if v_receipt.receipt_date < date '2026-08-12' then
    raise exception 'historical_receipt_immutable';
  end if;
  if exists (
    select 1 from public.receipt_payments
    where receipt_id = p_receipt_id and status = 'active'
  ) then
    raise exception 'receipt_has_active_payment';
  end if;

  if v_receipt.status = 'cancelled' then
    return jsonb_build_object(
      'ok', true, 'receipt_id', v_receipt.id, 'already_cancelled', true
    );
  end if;

  update public.hui_receipts
  set status = 'cancelled', cancelled_at = now(),
      cancel_reason = btrim(p_reason), updated_at = now()
  where id = p_receipt_id;

  insert into public.audit_logs (
    entity_type, entity_id, action, before_data, after_data, reason, actor_id
  ) values (
    'receipt', v_receipt.id::text, 'cancel_atomic', to_jsonb(v_receipt),
    jsonb_build_object('status', 'cancelled'), btrim(p_reason), v_actor
  );

  return jsonb_build_object('ok', true, 'receipt_id', v_receipt.id);
end;
$function$;

create or replace function public.period_has_active_money_private(
  p_period_id uuid
)
returns boolean
language sql
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.hui_periods hp
    join public.receipt_payments rp on rp.status = 'active'
    left join public.hui_receipts hr on hr.id = rp.receipt_id
    where hp.id = p_period_id
      and (
        rp.source_period_id = hp.id
        or (
          hr.receipt_date = hp.scheduled_date
          and exists (
            select 1 from public.hui_shares hs
            where hs.group_id = hp.group_id
              and hs.member_id = hr.member_id
          )
        )
      )
  );
$function$;

revoke all on function public.period_has_active_money_private(uuid)
from public, anon, authenticated;

create or replace function public.update_hui_period_result_atomic(
  p_period_id uuid,
  p_winner_share_id uuid,
  p_bid_amount numeric,
  p_fee_amount numeric,
  p_opened_at timestamptz,
  p_status text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_role public.app_role;
  v_actor uuid := auth.uid();
  v_period public.hui_periods%rowtype;
  v_after public.hui_periods%rowtype;
begin
  select public.current_app_role() into v_role;
  if v_role not in ('admin'::public.app_role, 'super_admin'::public.app_role) then
    raise exception 'forbidden';
  end if;

  select * into v_period from public.hui_periods
  where id = p_period_id for update;
  if not found then raise exception 'period_not_found'; end if;
  if v_period.scheduled_date < date '2026-08-12' then
    raise exception 'historical_period_immutable';
  end if;
  if p_bid_amount is null or p_fee_amount is null
     or p_bid_amount < 0 or p_fee_amount < 0
     or p_bid_amount <> trunc(p_bid_amount)
     or p_fee_amount <> trunc(p_fee_amount) then
    raise exception 'invalid_period_amount';
  end if;
  if p_opened_at is null then raise exception 'opened_at_required'; end if;
  if p_status not in ('opened', 'completed') then
    raise exception 'invalid_period_result_status';
  end if;
  if not exists (
    select 1 from public.hui_shares
    where id = p_winner_share_id and group_id = v_period.group_id
  ) then
    raise exception 'winner_share_not_in_group';
  end if;
  if public.period_has_active_money_private(p_period_id) then
    raise exception 'period_has_active_money';
  end if;

  update public.hui_periods
  set winner_share_id = p_winner_share_id,
      bid_amount = p_bid_amount,
      fee_amount = p_fee_amount,
      opened_at = p_opened_at,
      status = p_status,
      notes = nullif(btrim(coalesce(p_notes, '')), ''),
      updated_at = now()
  where id = p_period_id
  returning * into v_after;

  insert into public.audit_logs (
    entity_type, entity_id, action, before_data, after_data, reason, actor_id
  ) values (
    'hui_period', p_period_id::text, 'update_result_atomic',
    to_jsonb(v_period), to_jsonb(v_after), 'Cập nhật kết quả kỳ atomic', v_actor
  );

  return jsonb_build_object(
    'ok', true, 'period_id', v_after.id,
    'status', v_after.status, 'winner_share_id', v_after.winner_share_id
  );
end;
$function$;

create or replace function public.guard_receipt_cancel_with_active_payment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if new.status = 'cancelled'
     and old.status is distinct from new.status
     and exists (
       select 1 from public.receipt_payments
       where receipt_id = old.id and status = 'active'
     ) then
    raise exception 'receipt_has_active_payment';
  end if;
  return new;
end;
$function$;

create or replace function public.guard_hui_period_money_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if old.winner_share_id is not distinct from new.winner_share_id
     and old.bid_amount is not distinct from new.bid_amount
     and old.fee_amount is not distinct from new.fee_amount
     and old.opened_at is not distinct from new.opened_at
     and old.status is not distinct from new.status
     and old.group_id is not distinct from new.group_id
     and old.scheduled_date is not distinct from new.scheduled_date then
    return new;
  end if;

  if old.scheduled_date < date '2026-08-12' then
    raise exception 'historical_period_immutable';
  end if;
  if public.period_has_active_money_private(old.id) then
    raise exception 'period_has_active_money';
  end if;
  return new;
end;
$function$;

create or replace function public.guard_historical_receipt_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if old.receipt_date < date '2026-08-12'
     and new is distinct from old
     and coalesce(auth.role(), '') <> 'service_role'
     and not pg_has_role(session_user, 'postgres', 'member') then
    raise exception 'historical_receipt_immutable';
  end if;
  return new;
end;
$function$;

create or replace function public.guard_historical_receipt_payment_mutation()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_receipt_id uuid := case when tg_op = 'DELETE' then old.receipt_id else new.receipt_id end;
  v_receipt_date date;
begin
  select receipt_date into v_receipt_date
  from public.hui_receipts
  where id = v_receipt_id;

  if v_receipt_date < date '2026-08-12'
     and coalesce(auth.role(), '') <> 'service_role'
     and not pg_has_role(session_user, 'postgres', 'member') then
    raise exception 'historical_receipt_immutable';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

revoke all on function public.guard_receipt_cancel_with_active_payment()
from public, anon, authenticated;
revoke all on function public.guard_hui_period_money_update()
from public, anon, authenticated;
revoke all on function public.guard_historical_receipt_update()
from public, anon, authenticated;
revoke all on function public.guard_historical_receipt_payment_mutation()
from public, anon, authenticated;

drop trigger if exists p0_guard_receipt_cancel_with_active_payment
on public.hui_receipts;
create trigger p0_guard_receipt_cancel_with_active_payment
before update of status on public.hui_receipts
for each row execute function public.guard_receipt_cancel_with_active_payment();

drop trigger if exists p0_guard_historical_receipt_update
on public.hui_receipts;
create trigger p0_guard_historical_receipt_update
before update on public.hui_receipts
for each row execute function public.guard_historical_receipt_update();

drop trigger if exists p0_guard_historical_receipt_payment_mutation
on public.receipt_payments;
create trigger p0_guard_historical_receipt_payment_mutation
before insert or update or delete on public.receipt_payments
for each row execute function public.guard_historical_receipt_payment_mutation();

drop trigger if exists p0_guard_hui_period_money_update
on public.hui_periods;
create trigger p0_guard_hui_period_money_update
before update on public.hui_periods
for each row execute function public.guard_hui_period_money_update();

revoke all on function public.record_receipt_payment_atomic(uuid, jsonb, text, date, text)
from public, anon;
revoke all on function public.cancel_receipt_payment_atomic(uuid, text)
from public, anon;
revoke all on function public.cancel_receipt_atomic(uuid, text)
from public, anon;
revoke all on function public.update_hui_period_result_atomic(uuid, uuid, numeric, numeric, timestamptz, text, text)
from public, anon;

grant execute on function public.record_receipt_payment_atomic(uuid, jsonb, text, date, text)
to authenticated;
grant execute on function public.cancel_receipt_payment_atomic(uuid, text)
to authenticated;
grant execute on function public.cancel_receipt_atomic(uuid, text)
to authenticated;
grant execute on function public.update_hui_period_result_atomic(uuid, uuid, numeric, numeric, timestamptz, text, text)
to authenticated;

commit;
