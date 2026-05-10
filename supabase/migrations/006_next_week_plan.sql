-- 006_next_week_plan.sql
-- Persist next week's plan in the database so it syncs across
-- household members in real time (previously was localStorage-only).

alter table household_state add column if not exists next_week_plan jsonb;
