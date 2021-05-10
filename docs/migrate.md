# Migrate from old API

This is a list of notable changes compared to the old, beta version of API of trace.moe

## General

- https://trace.moe/api/search => https://api.trace.moe/search
- Even in error cases, the response is always a JSON object instead of a double-quoted string.
- Existing old API will be shuted down on 30 June, 2021

## Accounts

- Naming: API Token => API Key (It's more appropriate to call it a key instead of a token)
- You can use the API with or without an API ~~token~~ Key
- Existing old API Token cannot be used as an API Key, you've to become a sponsor to get an account with API Key
- Once you've an account, you can login the new Account page on trace.moe so you can reset the API Key yourself anytime
- `?token=xxxxxxxxxx` => `?key=xxxxxxxxxx`, or you can put it in HTTP header "x-trace-key" instead

## Search

- base64 image is no longer supported, image must be sent in blob
- HTTP POST of Form/JSON with base64 image is removed
- The `filter` param renamed to `anilistID`
- Use `cutBorders` param to turn on automatic black borders cutting. This is always on for the old API, this is now off by default.

## Search Results

- RawDocsCount, RawDocsSearchTime, ReRankSearchTime, CacheHit, trial, limit, limit_ttl, quota, quota_ttl fields are removed from search response
- `docs` renamed to `result` in search response
- Anilist info is not included in search response by Default. It only returns an Anilist ID. Use `anilistInfo` param to include additional anime info.
- at, season, anime, tokenthumb, title, mal_id, synonyms, is_adult removed from each result of search response
- `anilist_id` renamed to `anilist`
- If `anilistInfo` is used, all anime info coming from Anilist are all contained inside one object under the "anilist" key

## Me

- The response object from /me uses IP address / email address for the "id" field, "user_id" and "email" field is removed.
- There are also addition fields added, see the new API Docs for details.

## Quota and Limits

- Rate limit per minute, per 5-min or per hour is removed
- Added concurrency (parallel request) limit, defaults to 1 which means you have to make requests one after another
- Daily search quota removed but now it has monthly search quota
- Headers like `X-whatanime-limit`, `X-whatanime-quota` is removed (This is not renamed to x-ratelimit-limit)
- Previously I may manually tune down search accuracy when there is a busy traffic. I won't do that anymore.
- The API server now has a queue with priority. When the server is busy it would refuse to handle lower-priority users.
