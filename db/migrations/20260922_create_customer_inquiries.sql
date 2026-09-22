CREATE TABLE IF NOT EXISTS customer_inquiries (
  id serial PRIMARY KEY,
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title varchar(100) NOT NULL,
  content text NOT NULL,
  answer text,
  answered_by integer REFERENCES users(id) ON DELETE RESTRICT,
  answered_at timestamptz,
  answer_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_inquiries_title_check CHECK (char_length(btrim(title)) BETWEEN 1 AND 100),
  CONSTRAINT customer_inquiries_content_check CHECK (char_length(btrim(content)) BETWEEN 1 AND 3000),
  CONSTRAINT customer_inquiries_answer_check CHECK (
    (answer IS NULL AND answered_by IS NULL AND answered_at IS NULL AND answer_updated_at IS NULL)
    OR (answer IS NOT NULL AND char_length(btrim(answer)) BETWEEN 1 AND 3000 AND answered_by IS NOT NULL AND answered_at IS NOT NULL AND answer_updated_at IS NOT NULL AND answer_updated_at >= answered_at)
  )
);
CREATE INDEX IF NOT EXISTS customer_inquiries_user_created_idx ON customer_inquiries (user_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS customer_inquiries_created_idx ON customer_inquiries (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS customer_inquiries_pending_idx ON customer_inquiries (created_at DESC, id DESC) WHERE answer IS NULL;
