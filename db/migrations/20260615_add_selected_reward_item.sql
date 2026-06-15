BEGIN;

ALTER TABLE user_big_mission_progress
  ADD COLUMN IF NOT EXISTS selected_reward_item jsonb;

COMMIT;
