ALTER TABLE user_big_mission_progress
  ADD COLUMN IF NOT EXISTS reward_cancelled_at timestamp;

ALTER TABLE user_big_mission_progress
  ADD COLUMN IF NOT EXISTS reward_cancelled_by integer REFERENCES users(id);

ALTER TABLE user_big_mission_progress
  ADD COLUMN IF NOT EXISTS reward_cancel_reason text;
