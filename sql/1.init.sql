CREATE TABLE IF NOT EXISTS anilist (
  id integer PRIMARY KEY,
  updated timestamp NOT NULL DEFAULT NOW(),
  json jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS anilist_updated_idx ON anilist (updated);

CREATE MATERIALIZED VIEW IF NOT EXISTS anilist_view AS
SELECT
  nullif((anilist.json -> 'id'), 'null')::int AS id,
  nullif((anilist.json -> 'seasonYear'), 'null')::int AS season_year,
  nullif((anilist.json ->> 'season'), 'null')::text AS season,
  nullif((anilist.json ->> 'status'), 'null')::text AS status,
  nullif((anilist.json ->> 'countryOfOrigin'), 'null')::text AS country_of_origin,
  nullif((anilist.json ->> 'format'), 'null')::text AS format,
  (anilist.json -> 'isAdult')::boolean AS is_adult,
  nullif((anilist.json ->> 'episodes'), 'null')::int AS episodes,
  nullif((anilist.json ->> 'duration'), 'null')::int AS duration,
  nullif((anilist.json -> 'popularity'), 'null')::int AS popularity,
  anilist.json -> 'title' ->> 'native' AS title_native,
  anilist.json -> 'title' ->> 'chinese' AS title_chinese,
  anilist.json -> 'title' ->> 'romaji' AS title_romaji,
  anilist.json -> 'coverImage' ->> 'color' AS cover_image_color,
  anilist.json -> 'coverImage' ->> 'large' AS cover_image_large
FROM
  anilist;

CREATE UNIQUE INDEX IF NOT EXISTS anilist_view_id_idx ON anilist_view (id);

CREATE INDEX IF NOT EXISTS anilist_view_season_year_idx ON anilist_view (season_year);

CREATE INDEX IF NOT EXISTS anilist_view_season_idx ON anilist_view (season);

CREATE INDEX IF NOT EXISTS anilist_view_status_idx ON anilist_view (status);

CREATE INDEX IF NOT EXISTS anilist_view_country_of_origin_idx ON anilist_view (country_of_origin);

CREATE INDEX IF NOT EXISTS anilist_view_format_idx ON anilist_view (format);

CREATE INDEX IF NOT EXISTS anilist_view_is_adult_idx ON anilist_view (is_adult);

CREATE INDEX IF NOT EXISTS anilist_view_episodes_idx ON anilist_view (episodes);

CREATE INDEX IF NOT EXISTS anilist_view_duration_idx ON anilist_view (duration);

CREATE INDEX IF NOT EXISTS anilist_view_popularity_idx ON anilist_view (popularity);

CREATE INDEX IF NOT EXISTS anilist_view_title_native_idx ON anilist_view (title_native);

CREATE INDEX IF NOT EXISTS anilist_view_title_chinese_idx ON anilist_view (title_chinese);

CREATE INDEX IF NOT EXISTS anilist_view_title_romaji_idx ON anilist_view (title_romaji);

CREATE TABLE IF NOT EXISTS files (
  id serial PRIMARY KEY,
  anilist_id integer,
  episode smallint,
  path text NOT NULL,
  loaded boolean,
  created timestamp NOT NULL DEFAULT NOW(),
  updated timestamp NOT NULL DEFAULT NOW(),
  size bigint GENERATED ALWAYS AS (
    CAST((media_info -> 'format' ->> 'size') AS bigint)
  ) STORED,
  duration real GENERATED ALWAYS AS (
    CAST((media_info -> 'format' ->> 'duration') AS real)
  ) STORED,
  nb_streams smallint GENERATED ALWAYS AS (
    CAST(
      (media_info -> 'format' ->> 'nb_streams') AS smallint
    )
  ) STORED,
  bit_rate bigint GENERATED ALWAYS AS (
    CAST((media_info -> 'format' ->> 'bit_rate') AS bigint)
  ) STORED,
  frame_count integer,
  scene_count integer GENERATED ALWAYS AS (1 + jsonb_array_length(scene_changes)) STORED,
  media_info jsonb,
  scene_changes jsonb,
  color_layout bytea
);

CREATE INDEX IF NOT EXISTS files_anilist_id_idx ON files (anilist_id);

CREATE INDEX IF NOT EXISTS files_episode_idx ON files (episode);

CREATE UNIQUE INDEX IF NOT EXISTS files_path_idx ON files (path);

CREATE INDEX IF NOT EXISTS files_loaded_idx ON files (loaded);

CREATE INDEX IF NOT EXISTS files_created_idx ON files (created);

CREATE INDEX IF NOT EXISTS files_updated_idx ON files (updated);

CREATE INDEX IF NOT EXISTS files_media_pending_idx ON files (id DESC)
WHERE
  media_info IS NULL;

CREATE INDEX IF NOT EXISTS files_scene_pending_idx ON files (id DESC)
WHERE
  scene_changes IS NULL;

CREATE INDEX IF NOT EXISTS files_color_pending_idx ON files (id DESC)
WHERE
  color_layout IS NULL;

CREATE INDEX IF NOT EXISTS files_milvus_pending_idx ON files (id DESC)
WHERE
  loaded IS NULL
  AND media_info IS NOT NULL
  AND scene_changes IS NOT NULL
  AND color_layout IS NOT NULL;

CREATE OR REPLACE VIEW files_view AS
SELECT
  files.id,
  files.anilist_id,
  anilist.json ->> 'status' AS status,
  nullif((anilist.json -> 'seasonYear'), 'null')::int AS year,
  anilist.json ->> 'season' AS season,
  anilist.json ->> 'format' AS format,
  files.episode,
  nullif((anilist.json -> 'episodes'), 'null')::int AS episodes,
  files.duration,
  files.path
FROM
  files
  LEFT JOIN anilist ON files.anilist_id = anilist.id;

CREATE TABLE IF NOT EXISTS logs (
  id serial PRIMARY KEY,
  created timestamp NOT NULL DEFAULT NOW(),
  ip inet NOT NULL,
  network inet GENERATED ALWAYS AS (
    CASE
      WHEN family(ip) = 6 THEN set_masklen(ip::cidr, 64)
      ELSE set_masklen(ip::cidr, 32)
    END
  ) STORED,
  user_id integer,
  code integer NOT NULL,
  search_time integer DEFAULT NULL,
  accuracy real DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS logs_created_idx ON logs (created);

CREATE INDEX IF NOT EXISTS logs_ip_idx ON logs (ip);

CREATE INDEX IF NOT EXISTS logs_network_idx ON logs (network);

CREATE INDEX IF NOT EXISTS logs_user_id_idx ON logs (user_id);

-- For traffic stats page
CREATE INDEX IF NOT EXISTS logs_created_code_idx ON logs (created, code);

CREATE INDEX IF NOT EXISTS logs_created_search_time_idx ON logs (created, search_time);

CREATE INDEX IF NOT EXISTS logs_created_accuracy_idx ON logs (created, accuracy);

-- For quota in users_view
CREATE INDEX IF NOT EXISTS logs_user_quota_idx ON logs (user_id, created)
WHERE
  code = 200;

CREATE INDEX IF NOT EXISTS logs_network_quota_idx ON logs (network, created)
WHERE
  code = 200;

CREATE TABLE IF NOT EXISTS tiers (
  id serial PRIMARY KEY,
  priority integer NOT NULL,
  concurrency integer NOT NULL,
  quota integer NOT NULL,
  notes text NOT NULL,
  patreon_id integer NOT NULL
);

INSERT INTO
  tiers (
    id,
    priority,
    concurrency,
    quota,
    notes,
    patreon_id
  )
VALUES
  (0, 0, 1, 100, 'public', 0),
  (1, 2, 1, 100, '$1', 0),
  (2, 2, 1, 500, '$5', 0),
  (3, 5, 1, 1000, '$10', 0),
  (4, 5, 2, 2000, '$20', 0),
  (5, 5, 3, 5000, '$50', 0),
  (6, 6, 4, 10000, '$100', 0),
  (9, 9, 255, 2147483647, 'god', 0)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  tier integer REFERENCES tiers,
  email text UNIQUE NOT NULL,
  password text NOT NULL,
  api_key text UNIQUE NOT NULL,
  created timestamp NOT NULL DEFAULT NOW(),
  updated timestamp NOT NULL DEFAULT NOW(),
  notes text DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS users_api_key_idx ON users (api_key);

CREATE INDEX IF NOT EXISTS users_email_password_idx ON users (email, password);

CREATE OR REPLACE VIEW users_view AS
SELECT
  users.id,
  users.email,
  users.api_key,
  users.created,
  users.updated,
  users.notes,
  users.tier,
  COALESCE(logs.quota_used, 0) AS quota_used,
  tiers.quota,
  tiers.priority,
  tiers.concurrency
FROM
  users
  LEFT JOIN tiers ON tier = tiers.id
  LEFT JOIN (
    SELECT
      user_id,
      COUNT(*) AS quota_used
    FROM
      logs
    WHERE
      code = 200
      AND created > now() - '1 day'::interval
    GROUP BY
      user_id
  ) AS logs ON logs.user_id = users.id;

CREATE OR REPLACE VIEW logs_view AS
SELECT
  network,
  COALESCE(logs.quota_used, 0) AS quota_used,
  tiers.quota,
  tiers.priority,
  tiers.concurrency
FROM
  (
    SELECT
      quota,
      priority,
      concurrency
    FROM
      tiers
    WHERE
      id = 0
  ) AS tiers,
  (
    SELECT
      network,
      COUNT(*) AS quota_used
    FROM
      logs
    WHERE
      code = 200
      AND created > now() - '1 day'::interval
    GROUP BY
      network
  ) AS logs;

DO $$ BEGIN
    CREATE TYPE type_source AS ENUM('PATREON', 'GITHUB');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS webhook (
  id serial PRIMARY KEY,
  created timestamp NOT NULL DEFAULT NOW(),
  source type_source NOT NULL,
  json jsonb NOT NULL
);
