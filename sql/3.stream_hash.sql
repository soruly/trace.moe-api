ALTER TABLE files
ADD COLUMN IF NOT EXISTS stream_hash jsonb;

ALTER TABLE files
ADD COLUMN IF NOT EXISTS video_hash text GENERATED ALWAYS AS (stream_hash -> 0 ->> 'hash') STORED;

CREATE INDEX IF NOT EXISTS files_stream_hash_idx ON files USING gin (stream_hash);

CREATE INDEX IF NOT EXISTS files_video_hash_idx ON files (video_hash);
