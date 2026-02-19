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

CREATE UNIQUE INDEX ON anilist_view (id);

CREATE INDEX ON anilist_view (season_year);

CREATE INDEX ON anilist_view (season);

CREATE INDEX ON anilist_view (status);

CREATE INDEX ON anilist_view (country_of_origin);

CREATE INDEX ON anilist_view (format);

CREATE INDEX ON anilist_view (is_adult);

CREATE INDEX ON anilist_view (episodes);

CREATE INDEX ON anilist_view (duration);

CREATE INDEX ON anilist_view (popularity);

CREATE INDEX ON anilist_view (title_native);

CREATE INDEX ON anilist_view (title_chinese);

CREATE INDEX ON anilist_view (title_romaji);

CREATE TABLE IF NOT EXISTS files (
  id serial PRIMARY KEY,
  anilist_id integer,
  episode smallint,
  path text NOT NULL,
  loaded boolean NOT NULL DEFAULT false,
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
  scene_changes jsonb
);

CREATE INDEX IF NOT EXISTS files_anilist_id_idx ON files (anilist_id);

CREATE INDEX IF NOT EXISTS files_episode_idx ON files (episode);

CREATE INDEX IF NOT EXISTS files_path_idx ON files (path);

CREATE INDEX IF NOT EXISTS files_loaded_idx ON files (loaded);

CREATE INDEX IF NOT EXISTS files_created_idx ON files (created);

CREATE INDEX IF NOT EXISTS files_updated_idx ON files (updated);

CREATE TABLE IF NOT EXISTS files_color_layout (
  id integer PRIMARY KEY REFERENCES files ON DELETE CASCADE,
  color_layout bytea
);

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
  created timestamp NOT NULL DEFAULT NOW(),
  ip inet NOT NULL,
  user_id integer,
  code integer NOT NULL,
  search_time integer DEFAULT NULL,
  accuracy real DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS logs_created_idx ON logs (created);

CREATE INDEX IF NOT EXISTS logs_ip_idx ON logs (ip);

CREATE INDEX IF NOT EXISTS logs_user_id_idx ON logs (user_id);

CREATE INDEX IF NOT EXISTS logs_code_idx ON logs (code);

CREATE INDEX IF NOT EXISTS logs_search_time_idx ON logs (search_time);

CREATE INDEX IF NOT EXISTS logs_accuracy_idx ON logs (accuracy);

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
  (0, 0, 1, 1000, 'public', 0),
  (1, 2, 1, 1000, '$1', 0),
  (2, 2, 1, 5000, '$5', 0),
  (3, 5, 1, 10000, '$10', 0),
  (4, 5, 2, 20000, '$20', 0),
  (5, 5, 3, 50000, '$50', 0),
  (6, 6, 4, 100000, '$100', 0),
  (9, 9, 255, 2147483647, 'god', 0)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
  id serial PRIMARY KEY,
  tier integer REFERENCES tiers,
  email text UNIQUE NOT NULL,
  password text NOT NULL,
  api_key text UNIQUE NOT NULL,
  quota_used integer NOT NULL DEFAULT 0,
  created timestamp NOT NULL DEFAULT NOW(),
  updated timestamp NOT NULL DEFAULT NOW(),
  notes text DEFAULT NULL
);

CREATE OR REPLACE VIEW users_view AS
SELECT
  users.*,
  tiers.priority,
  tiers.concurrency,
  tiers.quota
FROM
  users
  LEFT JOIN tiers ON tier = tiers.id;

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

CREATE TABLE IF NOT EXISTS quota (
  ip inet PRIMARY KEY,
  network inet GENERATED ALWAYS AS (
    CASE
      WHEN family(ip) = 6 THEN set_masklen(ip::cidr, 56)
      ELSE set_masklen(ip::cidr, 32)
    END
  ) STORED,
  used integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS quota_network_idx ON quota (network);
