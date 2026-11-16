create extension if not exists pgcrypto;

create table if not exists public.foundation_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.foundation_admins enable row level security;
revoke all on public.foundation_admins from anon, authenticated;

create or replace function public.is_foundation_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.foundation_admins
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_foundation_admin() from public;
grant execute on function public.is_foundation_admin() to anon, authenticated;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 160),
  event_date date not null,
  event_time text check (event_time is null or char_length(event_time) <= 80),
  venue text not null check (char_length(venue) between 1 and 200),
  category text not null check (char_length(category) between 1 and 80),
  fee numeric(10, 2) not null default 0 check (fee >= 0),
  is_open boolean not null default true,
  is_published boolean not null default true,
  description text not null check (char_length(description) between 1 and 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique check (char_length(ref) between 1 and 32),
  event_id uuid references public.events(id) on delete set null,
  event_title text not null,
  event_date date not null,
  full_name text not null check (char_length(full_name) between 1 and 160),
  phone text not null check (char_length(phone) between 7 and 40),
  email text check (email is null or char_length(email) <= 254),
  age integer check (age is null or age between 1 and 120),
  city text check (city is null or char_length(city) <= 160),
  note text check (note is null or char_length(note) <= 2000),
  transaction_id text check (transaction_id is null or char_length(transaction_id) <= 160),
  fee numeric(10, 2) not null default 0 check (fee >= 0),
  created_at timestamptz not null default now()
);

create index if not exists registrations_created_at_idx on public.registrations (created_at desc);
create index if not exists registrations_event_id_idx on public.registrations (event_id);

create or replace function public.prepare_registration()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_event public.events%rowtype;
begin
  if new.event_id is null then
    raise exception 'An event is required for registration.';
  end if;

  select * into selected_event
  from public.events
  where id = new.event_id
    and is_published
    and is_open
    and event_date >= current_date;

  if not found then
    raise exception 'This event is not accepting registrations.';
  end if;

  if char_length(trim(new.full_name)) = 0
    or char_length(trim(new.full_name)) > 160
    or length(regexp_replace(new.phone, '\D', '', 'g')) < 10
    or length(regexp_replace(new.phone, '\D', '', 'g')) > 15 then
    raise exception 'A valid name and mobile number are required.';
  end if;

  if selected_event.fee > 0 and nullif(trim(new.transaction_id), '') is null then
    raise exception 'A payment transaction ID is required for this event.';
  end if;

  new.ref := coalesce(nullif(trim(new.ref), ''), 'LWF' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)));
  new.event_title := selected_event.title;
  new.event_date := selected_event.event_date;
  new.fee := selected_event.fee;
  new.full_name := trim(new.full_name);
  new.phone := trim(new.phone);
  return new;
end;
$$;

drop trigger if exists registrations_prepare on public.registrations;
create trigger registrations_prepare
before insert on public.registrations
for each row execute function public.prepare_registration();

alter table public.events enable row level security;
alter table public.registrations enable row level security;

drop policy if exists "Public can view published events" on public.events;
create policy "Public can view published events"
on public.events for select
to anon, authenticated
using (is_published);

drop policy if exists "Admins can manage events" on public.events;
create policy "Admins can manage events"
on public.events for all
to authenticated
using ((select public.is_foundation_admin()))
with check ((select public.is_foundation_admin()));

drop policy if exists "Visitors can submit registrations" on public.registrations;
create policy "Visitors can submit registrations"
on public.registrations for insert
to anon, authenticated
with check (true);

drop policy if exists "Admins can view registrations" on public.registrations;
create policy "Admins can view registrations"
on public.registrations for select
to authenticated
using ((select public.is_foundation_admin()));

grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;
grant insert on public.registrations to anon, authenticated;
grant select on public.registrations to authenticated;

insert into public.events (
  id, title, event_date, event_time, venue, category, fee, is_open, is_published, description
) values (
  'f7d8c814-55d4-4bd7-a15c-7913db717b75',
  'Education Paper Prize Distribution',
  '2026-11-15',
  null,
  'Chulkana, Samalkha (Panipat)',
  'Education',
  0,
  true,
  true,
  'Prize distribution for the Education Paper. First prize ₹3100, second prize ₹2100, third prize ₹1100. Register to attend.'
)
on conflict (id) do nothing;
