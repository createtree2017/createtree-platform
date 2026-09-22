ALTER TABLE customer_inquiries ADD COLUMN IF NOT EXISTS answer_revision integer NOT NULL DEFAULT 0;
ALTER TABLE customer_inquiries ADD COLUMN IF NOT EXISTS read_answer_revision integer NOT NULL DEFAULT 0;
UPDATE customer_inquiries SET answer_revision = 1 WHERE answer IS NOT NULL AND answer_revision = 0;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'customer_inquiries'::regclass AND conname = 'customer_inquiries_revision_check') THEN
    ALTER TABLE customer_inquiries ADD CONSTRAINT customer_inquiries_revision_check CHECK (read_answer_revision >= 0 AND answer_revision >= read_answer_revision);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS customer_inquiries_unread_idx ON customer_inquiries (user_id) WHERE answer IS NOT NULL AND answer_revision > read_answer_revision;
