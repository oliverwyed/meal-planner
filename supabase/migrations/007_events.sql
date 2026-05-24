ALTER TABLE household_state ADD COLUMN IF NOT EXISTS events JSONB DEFAULT '[]'::jsonb;
