-- Plan history: rolling log of the last N generated plans per household
alter table household_state
  add column if not exists plan_history jsonb not null default '[]';
