-- 005_auth_email.sql
-- Link households to Supabase auth users for email-based recovery.
-- Only the household creator gets linked; members who join via invite
-- code are not linked (no regression from previous behaviour).

alter table households add column if not exists auth_user_id uuid;
create index if not exists households_auth_user_id_idx on households(auth_user_id);