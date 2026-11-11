-- Profiles: one row per person
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  timezone text not null default 'America/New_York',
  reminder_on boolean not null default true,
  reminder_time time not null default '20:00',
  push_subscription jsonb,
  last_reminded_on date
);

-- Experiments: schedule is days of the week, 0 = Sunday
create table experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  where_note text,
  why_note text,
  schedule_days smallint[] not null check (cardinality(schedule_days) > 0),
  tracking text not null default 'check' check (tracking in ('check', 'picture')),
  photo_target smallint,
  start_date date not null,
  length_days smallint not null default 65,
  created_at timestamptz not null default now()
);

-- Logs: one per scheduled day; clearing a log deletes the row
create table logs (
  experiment_id uuid not null references experiments on delete cascade,
  day date not null,
  done boolean not null,
  note text,
  logged_at timestamptz not null default now(),
  primary key (experiment_id, day)
);

-- Decisions: written once at day 65
create table decisions (
  experiment_id uuid primary key references experiments on delete cascade,
  outcome text not null check (outcome in ('keep', 'drop')),
  effort text,
  survive text,
  cost text[],
  cost_note text,
  change text,
  decided_on date not null default current_date
);

-- Each person sees only their own rows
alter table profiles enable row level security;
alter table experiments enable row level security;
alter table logs enable row level security;
alter table decisions enable row level security;

create policy own_profile on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());
create policy own_experiments on experiments for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_logs on logs for all
  using (exists (select 1 from experiments e where e.id = experiment_id and e.user_id = auth.uid()))
  with check (exists (select 1 from experiments e where e.id = experiment_id and e.user_id = auth.uid()));
create policy own_decisions on decisions for all
  using (exists (select 1 from experiments e where e.id = experiment_id and e.user_id = auth.uid()))
  with check (exists (select 1 from experiments e where e.id = experiment_id and e.user_id = auth.uid()));
