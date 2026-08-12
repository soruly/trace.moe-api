ALTER TABLE files
ADD COLUMN IF NOT EXISTS episode_start smallint;

ALTER TABLE files
ADD COLUMN IF NOT EXISTS episode_end smallint;

UPDATE files
SET
  episode_start = episode,
  episode_end = episode
WHERE
  episode IS NOT NULL
  AND (
    episode_start IS NULL
    OR episode_end IS NULL
  );

CREATE INDEX IF NOT EXISTS files_episode_start_idx ON files (episode_start);

CREATE INDEX IF NOT EXISTS files_episode_end_idx ON files (episode_end);

CREATE INDEX IF NOT EXISTS files_anilist_ep_range_idx ON files (anilist_id, episode_start, episode_end);
