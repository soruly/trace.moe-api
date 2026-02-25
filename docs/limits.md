# Account and Limits

## HTTP Rate Limits

The API server has a global request rate limit of 100 requests/min per IP address (or IPv6 /64 block) with or without an API Key.

The rate limit info is included in the HTTP response header. If you hit this HTTP rate limit, the request will fail with HTTP 429 (Too Many Requests).

## API Search Quota and Limits

### Sponsor tiers

| Sponsor tiers | daily quota | concurrency | priority    |
| ------------- | ----------- | ----------- | ----------- |
| free          | 100         | 1           | 0 (lowest)  |
| $1            | 100         | 1           | 2           |
| $5            | 500         | 1           | 2           |
| $10           | 1000        | 1           | 5           |
| $20           | 2000        | 2           | 5           |
| $50           | 5000        | 3           | 5           |
| $100          | 10000       | 4           | 6 (highest) |

The free tier (non-sponsors) has no account and no API Key. However, you can still use the API without an API Key. You will be identified by your IP address. Any unique IP address will be considered as one unique user.

### Search Quota

If you are a sponsor, you can still use the API without an API Key. This grants you extra quota in addition to the free tier. This means if your program uses the API Key in a tricky way, you could get 100 (without API Key) + 100 (with API Key) = 200 daily quota.

Failed search requests like HTTP 4xx and 5xx don't count. You don't have to worry about wasting quota on malformed requests, broken images, throttled requests, or database errors.

Search quota counts in a rolling window of 24 hours. If you have reached your daily quota, the search request will fail with HTTP 402.

### Concurrency

Concurrency only applies to the /search endpoint.

Concurrency is the number of simultaneous (parallel) requests you can make to the API server.

If your concurrency is 1, you should send your requests one after another. If you send a second request before the first request responds, it will fail with HTTP 402. If your concurrency is 2, your 3rd request will fail when the server is already processing 2 of your previous requests. If you have a very popular chat bot that handles multiple requests at the same time, you will hit this limit very often.

Tips and solutions:

- Ask the API server to do less stuff for you. Avoid using the image url and the `cutBorders`, `anilistInfo` params. These features take some time for the server to download and process. And the longer the request takes, the higher the chance it will block your next request.
- If your program is a distributed app like a mobile app, send the API request directly from your clients without using an API Key.
- If your program is async (e.g. webhook/bots), implement a queue that sends search requests one after another.
- Or simply retry a few times when it fails. (It's fine unless you retry forever.)
- Also consider donating more to get a higher concurrency limit.

### Priority

With limited processing power available, the server has a priority queue to handle requests.

The server has multiple priority queues with a fixed total queue length. If the queue is full, upcoming new requests will be rejected with HTTP 503. If you have priority 5, the server will only reject your request when queue 6 and queue 5 are full, regardless of the queues below you. If you have priority 0, you'll only have your request processed when all the queues have empty slots left.

Assume the max queue length is 8:

| Current queue    | Acceptable request | Rejecting request |
| ---------------- | ------------------ | ----------------- |
| 🟦🟦🟦🟦🟦🟦🟦🟦 | 0️⃣2️⃣5️⃣6️⃣           | (none)            |
| 6️⃣5️⃣2️⃣0️⃣0️⃣0️⃣0️⃣🟦 | 0️⃣2️⃣5️⃣6️⃣           | (none)            |
| 6️⃣6️⃣6️⃣5️⃣2️⃣2️⃣2️⃣0️⃣ | 2️⃣5️⃣6️⃣             | 0️⃣                |
| 6️⃣6️⃣6️⃣5️⃣2️⃣2️⃣2️⃣2️⃣ | 5️⃣6️⃣               | 0️⃣2️⃣              |
| 6️⃣6️⃣6️⃣6️⃣6️⃣6️⃣5️⃣5️⃣ | 6️⃣                 | 0️⃣2️⃣5️⃣            |
| 6️⃣6️⃣6️⃣6️⃣6️⃣6️⃣6️⃣6️⃣ | (none)             | 0️⃣2️⃣5️⃣6️⃣          |

Whether there will be a queue or not depends on traffic conditions. You may take a look at the server traffic at https://trace.moe/about to guess when you will encounter a traffic jam.
