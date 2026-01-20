CREATE MATERIALIZED VIEW anilist_view AS
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
from
  anilist
