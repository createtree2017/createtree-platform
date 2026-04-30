BEGIN;

CREATE TABLE IF NOT EXISTS image_reference_uploads (
  id serial PRIMARY KEY,
  user_id varchar(128) NOT NULL,
  generated_image_id integer REFERENCES images(id) ON DELETE SET NULL,
  image_url text NOT NULL,
  storage_path text NOT NULL,
  file_name text,
  file_size integer,
  mime_type varchar(100),
  provider varchar(50) NOT NULL DEFAULT 'firebase',
  purpose varchar(50) NOT NULL DEFAULT 'generation_reference',
  status varchar(30) NOT NULL DEFAULT 'uploaded',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS image_reference_uploads_user_id_idx
  ON image_reference_uploads(user_id);

CREATE INDEX IF NOT EXISTS image_reference_uploads_generated_image_id_idx
  ON image_reference_uploads(generated_image_id);

CREATE UNIQUE INDEX IF NOT EXISTS image_reference_uploads_storage_path_idx
  ON image_reference_uploads(storage_path);

CREATE INDEX IF NOT EXISTS image_reference_uploads_status_idx
  ON image_reference_uploads(status);

CREATE INDEX IF NOT EXISTS image_reference_uploads_created_at_idx
  ON image_reference_uploads(created_at);

COMMIT;
