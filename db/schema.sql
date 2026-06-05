create extension if not exists pgcrypto;

create table if not exists items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  media_url text not null,
  media_type text not null check (media_type in ('image', 'video')),
  created_at timestamptz not null default now()
);

create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  created_at timestamptz not null default now(),
  ip_hash text not null,
  household_hash text not null,
  isp text
);

alter table if exists votes
  add constraint votes_item_household_unique unique (item_id, household_hash);

create table if not exists voters (
  id uuid primary key default gen_random_uuid(),
  household_hash text not null unique,
  ip_hash text not null,
  last_vote_at timestamptz not null default now(),
  vote_count_today integer not null default 0
);

create index if not exists votes_item_id_created_at_idx on votes (item_id, created_at desc);
create index if not exists votes_household_created_at_idx on votes (household_hash, created_at desc);
create index if not exists voters_ip_hash_idx on voters (ip_hash);