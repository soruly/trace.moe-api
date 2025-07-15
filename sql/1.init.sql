CREATE TABLE IF NOT EXISTS anilist (
  id integer PRIMARY KEY,
  updated timestamp NOT NULL DEFAULT NOW(),
  json jsonb NOT NULL
);

CREATE INDEX ON anilist (id);

CREATE INDEX ON anilist (updated);

-- NEW => ANALYZING => ANALYZED => HASHING => HASHED => LOADING => LOADED
CREATE TYPE type_status AS ENUM(
  'NEW',
  'ANALYZING',
  'ANALYZED',
  'HASHING',
  'HASHED',
  'LOADING',
  'LOADED'
);

CREATE TABLE IF NOT EXISTS files (
  id serial PRIMARY KEY,
  path text NOT NULL,
  status type_status NOT NULL,
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
  scene_count integer GENERATED ALWAYS AS (1 + jsonb_array_length(scene_changes)) STORED,
  media_info jsonb,
  scene_changes jsonb
);

CREATE INDEX ON files (path);

CREATE INDEX ON files (status);

CREATE INDEX ON files (created);

CREATE INDEX ON files (updated);

CREATE TABLE IF NOT EXISTS logs (
  created timestamp NOT NULL DEFAULT NOW(),
  ip inet NOT NULL,
  user_id integer,
  code integer NOT NULL,
  search_time integer DEFAULT NULL,
  accuracy real DEFAULT NULL
);

CREATE INDEX ON logs (created);

CREATE INDEX ON logs (ip);

CREATE INDEX ON logs (user_id);

CREATE INDEX ON logs (code);

CREATE INDEX ON logs (search_time);

CREATE INDEX ON logs (accuracy);

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

CREATE VIEW users_view AS
SELECT
  users.*,
  tiers.priority,
  tiers.concurrency,
  tiers.quota
FROM
  users
  LEFT JOIN tiers ON tier = tiers.id;

CREATE TYPE type_source AS ENUM('PATREON', 'GITHUB');

CREATE TABLE IF NOT EXISTS webhook (
  id serial PRIMARY KEY,
  created timestamp NOT NULL DEFAULT NOW(),
  source type_source NOT NULL,
  json jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS quota (
  ip inet PRIMARY KEY,
  used integer NOT NULL DEFAULT 0
);
