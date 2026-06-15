ALTER TABLE user_big_mission_progress
  ADD COLUMN IF NOT EXISTS reward_shipping_address text;

ALTER TABLE user_big_mission_progress
  ADD COLUMN IF NOT EXISTS reward_memo text;
