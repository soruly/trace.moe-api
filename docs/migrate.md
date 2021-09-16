# Migrating from the old API

This is a list of notable changes compared to the old, beta version of API of trace.moe

## General

- *https://trace.moe/api/search* => **https://api.trace.moe/search**
- Even in error events, the response will always return a JSON object instead of a double-quoted string.
- The existing old API will be shut down on 30 June, 2021. After that date, all changes will take effect.

## Accounts

- Renaming: *API Token* => **API Key** (It's more appropriate to call it a key instead of a token!)
- You can use the API with or without an API Key.
- The existing old API Token cannot be used as an API Key, you have to become a [sponsor](https://github.com/sponsors/soruly) to get an account with an API Key.
- Once you have an account, you can log into the new account page on trace.moe so you can reset the API Key yourself anytime you want and need to.
- `?token=xxxxxxxxxx` => `?key=xxxxxxxxxx`, or you can just put it in the HTTP header "x-trace-key" instead.

## Search

- The `base64` image is no longer supported,the  image must be sent in `blob`. Reason for this being `base64` has always been an inefficient way. Addiotionally, this means `HTTP POST` of `Form/JSON` with the base64 image is removed as well.
- The `filter` param has been renamed to `anilistID`.
- Use the `cutBorders` param to turn on automatic black borders cutting. This has been always on for the old API, however it's now turned off by default.

## Search Results

- Fields that got removed from the search response:
`RawDocsCount`, `RawDocsSearchTim`, `ReRankSearchTime`, `CacheHit`, `trial`, `limit`, `limit_ttl`, `quota`, and `quota_ttl`. 
- `docs` has been renamed to `result` in search response.
- Anilist info is not included in the search response by default. It only returns an Anilist ID. Use the `anilistInfo` param to include additional anime info.
- `at`, `season`, `anime`, `tokenthumb`, `title`, `mal_id`, `synonyms`, `is_adult` have been removed from each result of the search response.
- `anilist_id` has been renamed to `anilist`.
- If `anilistInfo` is used, all anime info coming from Anilist are all contained inside one object under the "anilist" key.

## Me

- The response object from /me now uses IP address / email address. The following fields have been removed: "id" field, "user_id" and the "email" field.
- There are also addition fields added, see the new API Docs for details.

## Quota and Limits

- The rate limit per minute, per 5 minutes and per hour have been removed; now added concurrency (parallel request) limit, defaults to 1 which means you have to make requests one after another.
- Daily search quota has been removed; now has monthly search quota.
- Headers like `X-whatanime-limit`, `X-whatanime-quota` have been removed (This wasn't renamed to x-ratelimit-limit).
- Previously I may manually tune down search accuracy when there is busy traffic. I won't do that anymore.
- The API server now has a queue with priority. When the server is busy it would refuse to handle lower-priority users.
