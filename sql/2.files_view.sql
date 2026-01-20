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
  LEFT JOIN anilist ON files.anilist_id = anilist.id
