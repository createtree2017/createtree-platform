ALTER TABLE big_missions
  ADD COLUMN IF NOT EXISTS reward_selection_limit integer NOT NULL DEFAULT 1;
