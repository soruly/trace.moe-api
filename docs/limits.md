# Account and Limits

## HTTP Rate Limits

The API server has a global request rate limit of 100 requests/min per IP address (or IPv6 /56 block) with or without an API Key.

The rate limit info is included in the HTTP response header. If you hit this HTTP rate limit, request would fail with HTTP 429 (Too Many Requests).

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

free tier (non-sponsors) has no account and has no API Key. But they can still use the API without and API Key. They would be identified by IP address. Any unique IP address would be considered as one unique user.

### Search Quota

If you are a sponsor, you can still use the API without an API Key. This grant you extra quota in addition to free tiers. Which means if your program use the API Key in a tricky way, you could get 100 (without API Key) + 100 (with API Key) = 200 daily quota.

Failed search requests like HTTP 4xx and 5xx don't count. You don't have to worry about wasting quota on malformed requests, broken images, throttled requests or database errors.

Search quota counts in a rolling window of 24 hours. If you have reached your daily quota, search request would fail with HTTP 402.

### Concurrency

Concurrency only applies to the /search endpoint.

Concurrency is the number of simultaneous (parallel) requests you can make to the API server.

If your concurrency is 1, you should send your request one after another. If you send a second request before the first request respond, it would fail with HTTP 402. If your concurrency is 2, your 3rd request would fail when server is already processing 2 of your previous requests. If you have a very popular chat bot that handles multiple requests at the same time, you would hit this limit very often.

Tips and solutions:

- Ask the API server to do less stuff for you. Avoid using image url and the `cutBorders`, `anilistInfo` params. These features takes some time for the server to download and process. And the longer the requests takes, the higher chance it would block your next request.
- if your program is a distributed app like mobile app, send the API request directly from your clients without using API Key.
- if your program is async (e.g. webhook/bots), implement a queue that send search requests one after another
- or simply retry a few times when fails. (it's fine unless you retry like forever)
- also consider to donate more to get more concurrency limit.

### Priority

With limited processing power available, the server has priority queue to handle requests.

The server has multiple priority queues with a fixed total queue length. If the queue is full, upcoming new requests would be rejected with HTTP 503. If you have priority 5, server would only reject your request only when queue 6 and queue 5 is full, regardless of the queues below you. If you have priority 0, you'll only have your request processed when all the queue has empty slots left.

Assume the max queue length is 8:

| Current queue    | Acceptable request | Rejecting request |
| ---------------- | ------------------ | ----------------- |
| 🟦🟦🟦🟦🟦🟦🟦🟦 | 0️⃣2️⃣5️⃣6️⃣           | (none)            |
| 6️⃣5️⃣2️⃣0️⃣0️⃣0️⃣0️⃣🟦 | 0️⃣2️⃣5️⃣6️⃣           | (none)            |
| 6️⃣6️⃣6️⃣5️⃣2️⃣2️⃣2️⃣0️⃣ | 2️⃣5️⃣6️⃣             | 0️⃣                |
| 6️⃣6️⃣6️⃣5️⃣2️⃣2️⃣2️⃣2️⃣ | 5️⃣6️⃣               | 0️⃣2️⃣              |
| 6️⃣6️⃣6️⃣6️⃣6️⃣6️⃣5️⃣5️⃣ | 6️⃣                 | 0️⃣2️⃣5️⃣            |
| 6️⃣6️⃣6️⃣6️⃣6️⃣6️⃣6️⃣6️⃣ | (none)             | 0️⃣2️⃣5️⃣6️⃣          |

Whether there would be a queue or not depends on traffic conditions. You may take a look at the server traffic at https://trace.moe/about to guess when you would encounter a traffic jam.
