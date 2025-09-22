
-- 참여형 마일스톤을 위한 새 필드들 추가
ALTER TABLE milestones 
ADD COLUMN IF NOT EXISTS badge_emoji VARCHAR(10) DEFAULT '🎯',
ADD COLUMN IF NOT EXISTS encouragement_message VARCHAR(200) DEFAULT '참여해주셔서 감사합니다!',
ADD COLUMN IF NOT EXISTS campaign_start_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS campaign_end_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS selection_start_date TIMESTAMP,
ADD COLUMN IF NOT EXISTS selection_end_date TIMESTAMP;

-- 기존 마일스톤의 type을 업데이트
UPDATE milestones SET type = 'campaign' WHERE type IS NULL OR type = '';

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_milestones_type ON milestones(type);
CREATE INDEX IF NOT EXISTS idx_milestones_campaign_dates ON milestones(campaign_start_date, campaign_end_date);
