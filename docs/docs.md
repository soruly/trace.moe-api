# API Docs

You may also refer to the swagger docs on [SwaggerHub](https://app.swaggerhub.com/apis/soruly/api.trace.moe/1.0.0#/)

## /search

### Search by image URL

<!-- tabs:start -->

#### **cURL**

```bash
curl "https://api.trace.moe/search?url=https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg"
```

#### **PowerShell**

```powershell
Invoke-RestMethod "https://api.trace.moe/search?url=https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg"
```

#### **javascript**

```javascript
await fetch(
  `https://api.trace.moe/search?url=${encodeURIComponent(
    "https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg",
  )}`,
).then((e) => e.json());
```

#### **python**

```python
import requests
import urllib.parse
requests
.get("https://api.trace.moe/search?url={}"
  .format(urllib.parse.quote_plus("https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg"))
).json()
```

<!-- tabs:end -->

This method is the easiest if your image is already hosted somewhere in public. Otherwise, you must upload the image.

### Search by image upload

<!-- tabs:start -->

#### **cURL**

```
curl --data-binary "@demo.jpg" https://api.trace.moe/search
```

#### **PowerShell**

```powershell
Invoke-RestMethod -Method Post -InFile .\demo.jpg https://api.trace.moe/search
```

#### **javascript**

```javascript
// For nodejs only
import fs from "node:fs/promises";
await fetch("https://api.trace.moe/search", {
  method: "POST",
  body: await fs.readFile("./demo.jpg"),
  headers: { "Content-type": "image/jpeg" },
}).then((e) => e.json());
```

#### **python**

```python
import requests
requests.post("https://api.trace.moe/search",
  data=open("demo.jpg", "rb"),
  headers={"Content-Type": "image/jpeg"}
).json()
```

<!-- tabs:end -->

Supported Content-Types are `image/*`, `video/*`, `application/octet-stream`, and `application/x-www-form-urlencoded`

File size is limited to 25MB. The server would throw HTTP 413 Payload Too Large if it is too large.

### Search by FORM POST (multipart/form-data)

<!-- tabs:start -->

#### **HTML**

```html
<form action="https://api.trace.moe/search" method="POST" enctype="multipart/form-data">
  <input type="file" name="image" />
  <input type="submit" />
</form>
```

#### **cURL**

```
curl -F "image=@demo.jpg" https://api.trace.moe/search
```

#### **PowerShell**

```powershell
// Requires PowerShell 7.x
Invoke-RestMethod -Method Post -Form @{image=Get-Item -Path "demo.jpg"} https://api.trace.moe/search
```

#### **javascript**

```javascript
// For web browsers only
const formData = new FormData();
formData.append("image", imageBlob);
await fetch("https://api.trace.moe/search", {
  method: "POST",
  body: formData,
}).then((e) => e.json());
```

File size is limited to 25MB. The server would throw HTTP 413 Payload Too Large if it is too large.

#### **python**

```python
import requests
requests.post("https://api.trace.moe/search",
  files={"image": open("demo.jpg", "rb")}
).json()
```

<!-- tabs:end -->

### Search by color layout vector

If you already have extracted the 33-dimensional color layout vector of the image, you can search by vector directly. This is much faster and saves bandwidth compared to sending images.

You can extract the MPEG-7 ColorLayout vector using the official [trace.moe-id](https://github.com/soruly/trace.moe-id) library (`npm install trace.moe-id`), which supports both Node.js and web browsers.

You can perform search for a single vector, or a batch search for multiple vectors (up to 10 vectors).

Your search quota will be reduced by 1 for each vector.

You can send the base64 hash string via query string (`?vector=...`), or send a JSON payload with a `vector` field:

- **Single Vector**:
  - Base64 hash string (from `ColorLayout.encode(vector)`): `"gwebWzth7oPe2UIubOJmozi1NDFp"`
  - An array of 33 numbers: `[32, 24, 7, 19, 13, 13, 19, 22, 24, 15, 14, 16, 15, 15, 13, 18, 16, 17, 14, 13, 19, 34, 12, 26, 17, 19, 17, 26, 19, 8, 12, 11, 9]`
- **Multiple Vectors (Batch search, max 10)**:
  - An array of base64 hash strings: `["gwebWzth...", "gwebWzth..."]`
  - A 2D array of numbers: `[[32, 24, ...], [32, 24, ...]]`

<!-- tabs:start -->

#### **cURL**

```bash
# via query string (GET)
curl "https://api.trace.moe/search?vector=gwebWzth7oPe2UIubOJmozi1NDFp"

# via JSON payload (POST)
curl -X POST -H "Content-Type: application/json" -d '{"vector": "gwebWzth7oPe2UIubOJmozi1NDFp"}' https://api.trace.moe/search
```

#### **PowerShell**

```powershell
# via query string (GET)
Invoke-RestMethod "https://api.trace.moe/search?vector=gwebWzth7oPe2UIubOJmozi1NDFp"

# via JSON payload (POST)
$body = @{ vector = "gwebWzth7oPe2UIubOJmozi1NDFp" } | ConvertTo-Json
Invoke-RestMethod -Method Post -ContentType "application/json" -Body $body https://api.trace.moe/search
```

#### **javascript**

```javascript
// In Node.js (with sharp and trace.moe-id)
import sharp from "sharp";
import { ColorLayout } from "trace.moe-id";

const { data, info } = await sharp("demo.jpg").raw().toBuffer({ resolveWithObject: true });
const cl = ColorLayout.extract({
  data: new Uint8Array(data),
  width: info.width,
  height: info.height,
  channels: info.channels,
});

await fetch("https://api.trace.moe/search", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ vector: cl }),
}).then((e) => e.json());
```

```javascript
// In Web Browser (with canvas and trace.moe-id)
import { ColorLayout } from "trace.moe-id";

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

const cl = ColorLayout.extract({
  data: imageData.data,
  width: imageData.width,
  height: imageData.height,
  channels: 4,
});

await fetch("https://api.trace.moe/search", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ vector: cl }),
}).then((e) => e.json());
```

```javascript
// Batch search (up to 10 vectors)
await fetch("https://api.trace.moe/search", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    vector: [cl1, cl2],
  }),
}).then((e) => e.json());
```

#### **python**

```python
import requests
requests.post("https://api.trace.moe/search",
  json={"vector": "gwebWzth7oPe2UIubOJmozi1NDFp"}
).json()
```

<!-- tabs:end -->

#### Batch Search Response Format

When a batch of multiple vectors is requested, the `result` field in the JSON response will be a 2-dimensional array of search results, corresponding to the input vectors in the same order.

```json
{
  "frameCount": 745506,
  "error": "",
  "quota": 1000,
  "quotaUsed": 45,
  "result": [
    [
      {
        "anilist": 99939,
        "filename": "Nekopara - OVA.mp4",
        "similarity": 0.94,
        ...
      }
    ],
    [
      {
        "anilist": 99939,
        "filename": "Nekopara - OVA.mp4",
        "similarity": 0.97,
        ...
      }
    ]
  ]
}
```

### Cut Black Borders

trace.moe can detect black borders automatically and cut away unnecessary parts of the images that would affect search result accuracy. This is useful if your image is a screencap from a smartphone or iPad that contains black bars.

To enable black border crop, add `cutBorders` to the query string. e.g.

<!-- tabs:start -->

#### **cURL**

```bash
curl "https://api.trace.moe/search?cutBorders&url=https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg"
```

#### **PowerShell**

```powershell
Invoke-RestMethod "https://api.trace.moe/search?cutBorders&url=https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg"
```

#### **javascript**

```javascript
await fetch(
  `https://api.trace.moe/search?cutBorders&url=${encodeURIComponent(
    "https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg",
  )}`,
).then((e) => e.json());
```

#### **python**

```python
import requests
import urllib.parse
requests
.get("https://api.trace.moe/search?cutBorders&url={}"
  .format(urllib.parse.quote_plus("https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg"))
).json()
```

<!-- tabs:end -->

### Filter by Anilist ID

You can search for a matching scene only in a particular anime by Anilist ID. This is useful when you are certain about the anime name but cannot remember which episode.

First, you have to look for the Anilist ID of your anime from [AniList](https://anilist.co/). Then add `anilistID=1` to the query string. e.g. Anilist ID of Cowboy Bebop is 1

<!-- tabs:start -->

#### **cURL**

```bash
curl "https://api.trace.moe/search?anilistID=1&url=https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg"
```

#### **PowerShell**

```powershell
Invoke-RestMethod "https://api.trace.moe/search?anilistID=1&url=https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg"
```

#### **javascript**

```javascript
await fetch(
  `https://api.trace.moe/search?anilistID=1&url=${encodeURIComponent(
    "https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg",
  )}`,
).then((e) => e.json());
```

#### **python**

```python
import requests
import urllib.parse
requests
.get("https://api.trace.moe/search?anilistID=1&url={}"
  .format(urllib.parse.quote_plus("https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg"))
).json()
```

<!-- tabs:end -->

### Search Image Format

trace.moe supports any media format that can be decoded by [ffmpeg](https://www.ffmpeg.org/), including video and gif. When using video / gif, only the 1st frame would be extracted for searching.

Your image / video must be smaller than 25MB. Otherwise it would fail with HTTP 413 (Request Entity Too Large).

The recommended resolution is 640 x 360px. Higher resolution doesn't yield better search results. The algorithm is also resistant to jpeg artifacts, so you don't have to use uncompressed formats like png.

### Response format

```json
{
  "frameCount": 745506,
  "error": "",
  "quota": 100,
  "quotaUsed": 1,
  "result": [
    {
      "anilist": 99939,
      "filename": "Nekopara - OVA (BD 1280x720 x264 AAC).mp4",
      "episode": null,
      "episode_start": null,
      "episode_end": null,
      "duration": 3486.4817,
      "from": 97.7226,
      "to": 98.8905,
      "at": 98.2231,
      "similarity": 0.9440424588727485,
      "video": "https://api.trace.moe/video/uAWzRPYDwVC2pxTsPyqvLeh",
      "image": "https://api.trace.moe/image/uAWzRPYDwVC2pxTsPyqvLeh"
    }
  ]
}
```

| Fields     | Meaning                              | Value            |
| ---------- | ------------------------------------ | ---------------- |
| frameCount | Total number of frames searched      | number           |
| quota      | Max quota you can use every 24 hours | number           |
| quotaUsed  | Quota you have used in last 24 hours | number           |
| error      | Error message                        | string           |
| result     | Search results (see table below)     | Array of Objects |

| Fields        | Meaning                                        | Value                                             |
| ------------- | ---------------------------------------------- | ------------------------------------------------- |
| anilist       | The matching Anilist ID or Anilist info        | number or object                                  |
| filename      | The filename of file where the match is found  | string                                            |
| episode       | The extracted episode number from filename     | Refer to [aniep](https://github.com/soruly/aniep) |
| episode_start | The starting episode number covered by file    | number or null                                    |
| episode_end   | The ending episode number covered by file      | number or null                                    |
| duration      | Duration of the matching video (seconds)       | number                                            |
| from          | Starting time of the matching scene (seconds)  | number (up to 4 decimal places)                   |
| at            | Time of the matching frame (seconds)           | number (up to 4 decimal places)                   |
| to            | Ending time of the matching scene (seconds)    | number (up to 4 decimal places)                   |
| similarity    | Similarity compared to the search image        | number (0 to 1)                                   |
| video         | URL to the preview video of the matching scene | string                                            |
| image         | URL to the preview image of the matching scene | string                                            |

- Results are sorted from most similar to least similar
- Similarity lower than 90% are most likely incorrect results. It's up to you to judge what is a match and what is just visually similar.
- `episode` can be null because it is just a result of parsing the `filename` with [aniep](https://github.com/soruly/aniep)
- `episode_start` and `episode_end` represents the actual episode range of the file. This is useful for files that contain multiple episodes (e.g., EP01-02, EP07-12). If it's just one episode (usually), `episode_start` and `episode_end` is set to the same number.
- `episode_start` and `episode_end` are always integers (no x.5 episodes). They are never 0 and always start with 1.
- `episode_start` and `episode_end` follows the episode order from anilist. Even if the filename suggest it's EP13, `episode_start` and `episode_end` will still be 1 if anilist suggest that the first season only has 12 episodes. This is managed by database maintainer manually.
- `episode_start` and `episode_end` are both null when the episode is unknown or invalid (e.g. specials, trailers, etc.)

By default, it only returns Anilist ID for search results. To get more anime info, make a second query to [AniList API](https://github.com/AniList/ApiV2-GraphQL-Docs). If you need Chinese-translated titles, take a look at [anilist-chinese](https://github.com/soruly/anilist-chinese)

### Include Anilist info

Asking for Anilist info would slow down your request because it takes an additional query to Anilist, and may fail depending on their availability.

If you only need `idMal`, `title`, `synonyms`, and `isAdult` from Anilist, you can add `anilistInfo` to the query string. e.g.

<!-- tabs:start -->

#### **cURL**

```bash
curl "https://api.trace.moe/search?anilistInfo&url=https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg"
```

#### **PowerShell**

```powershell
Invoke-RestMethod "https://api.trace.moe/search?anilistInfo&url=https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg"
```

#### **javascript**

```javascript
await fetch(
  `https://api.trace.moe/search?anilistInfo&url=${encodeURIComponent(
    "https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg",
  )}`,
).then((e) => e.json());
```

#### **python**

```python
import requests
import urllib.parse
requests
.get("https://api.trace.moe/search?anilistInfo&url={}"
  .format(urllib.parse.quote_plus("https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg"))
).json()
```

<!-- tabs:end -->

Example response

```json
{
  "frameCount": 745506,
  "error": "",
  "quota": 100,
  "quotaUsed": 1,
  "result": [
    {
      "anilist": {
        "id": 99939,
        "idMal": 34658,
        "title": { "native": "ネコぱらOVA", "romaji": "Nekopara OVA", "english": null },
        "synonyms": ["Neko Para OVA"],
        "isAdult": false
      },
      "filename": "Nekopara - OVA (BD 1280x720 x264 AAC).mp4",
      "episode": null,
      "duration": 3486.4817,
      "from": 97.7226,
      "to": 98.8905,
      "at": 98.2231,
      "similarity": 0.9440424588727485,
      "video": "https://api.trace.moe/video/uAWzRPYDwVC2pxTsPyqvLeh",
      "image": "https://api.trace.moe/image/uAWzRPYDwVC2pxTsPyqvLeh"
    }
  ]
}
```

The data inside the anilist object is an unmodified response from Anilist API. This data is managed by Anilist and they may change or delete these entries at any time.

Some title variants would be null. Please read [this section on Anilist API Docs](https://anilist.gitbook.io/anilist-apiv2-docs/overview/migrating-from-apiv1#media-titles) for explanations. It is recommended to have some fallback when selecting your preferred title.

### Error codes

Example Error response

```json
{
  "error": "Concurrency limit exceeded"
}
```

Example Quota Depleted response

```json
{
  "quota": 100,
  "quotaUsed": 100,
  "error": "Search quota depleted (quota per 24 hours: 100, used: 100)"
}
```

| HTTP Status | Possible Causes                                                         |
| ----------- | ----------------------------------------------------------------------- |
| 400         | Invalid image url / Failed to process image / Too many vectors (max 10) |
| 402         | Search quota depleted / Concurrency limit exceeded                      |
| 403         | Invalid API key                                                         |
| 405         | Method Not Allowed                                                      |
| 500         | Internal Server Error                                                   |
| 503         | Search queue is full / Database is not responding                       |
| 504         | Server is overloaded                                                    |

> the "error" value is empty string when there's no error

### Media Preview

The url you obtained from `image` and `video` from search result would expire in 300 seconds (5 minutes)

#### Image Preview (`/image/{id}`)

It can generate image preview of 3 sizes by appending `size=l` (large, 640px), `size=m` (medium, 320px, default) or `size=s` (small, 160px) at the end of the url. e.g.

```
https://api.trace.moe/image/s5ev1nvsjMo9dIteUKim6Gj?size=l
```

Supported image formats are `jxl`, `webp`, and `jpeg`, which are decided by web browsers through the HTTP `Accept` header, with a fallback to `jpeg` as default.

#### Video Preview (`/video/{id}`)

For video preview, it can generate a video with sound (default), or a muted video by appending `mute` to the query string. You can also adjust the scene duration range using `minDuration` (0.5s to 2.0s, default 0.5) and `maxDuration` (0.5s to 5.0s, default 5.0). e.g.

```
https://api.trace.moe/video/s5ev1nvsjMo9dIteUKim6Gj?mute
https://api.trace.moe/video/s5ev1nvsjMo9dIteUKim6Gj?size=l&mute&minDuration=1&maxDuration=4
```

The video response also includes custom HTTP headers indicating scene bounds:

- `x-video-start`: Start time of the detected scene in seconds
- `x-video-end`: End time of the detected scene in seconds
- `x-video-duration`: Total duration of the preview video in seconds

> Do not attempt to parse and modify the urls except documented above. The urls are not permanent and may change without notice.

Error codes

| HTTP Status | Meaning                                         |
| ----------- | ----------------------------------------------- |
| 200         | OK                                              |
| 400         | Invalid url param                               |
| 403         | Invalid token                                   |
| 404         | File not found                                  |
| 410         | Token Expired                                   |
| >=500       | Server Error (Maybe broken video or overloaded) |

## /me

Let you check the search quota and limit for your account (with API key) or IP address (without API key).

<!-- tabs:start -->

#### **cURL**

```bash
curl "https://api.trace.moe/me"
```

#### **PowerShell**

```powershell
Invoke-RestMethod "https://api.trace.moe/me"
```

#### **javascript**

```javascript
await fetch("https://api.trace.moe/me").then((e) => e.json());
```

#### **python**

```python
import requests
requests.get("https://api.trace.moe/me").json()
```

<!-- tabs:end -->

Example Response

```json
{
  "id": "127.0.0.1",
  "priority": 0,
  "concurrency": 1,
  "quota": 1000,
  "quotaUsed": 43
}
```

| Fields      | Meaning                                         | Value              |
| ----------- | ----------------------------------------------- | ------------------ |
| id          | IP address (guest) or email address (user)      | string             |
| priority    | Your priority in search queue                   | number (0: lowest) |
| concurrency | Number of parallel search requests you can make | number             |
| quota       | Max quota you can use every 24 hours            | number             |
| quotaUsed   | Quota you have used in last 24 hours            | number             |

### Usage History

You can query your search history broken down by time period by adding `?period=minute` (past 60 minutes), `?period=hour` (past 72 hours), or `?period=day` (past 60 days).

```bash
curl "https://api.trace.moe/me?period=hour"
```

Example Response:

```json
[
  {
    "time": "2026-08-21T12:00:00.000Z",
    "200": 24,
    "400": 1,
    "402": 0,
    "405": 0,
    "500": 0,
    "503": 0,
    "total": 25
  }
]
```

## /anilist (Unofficial)

Search anime entries and metadata by title or synonym query.

<!-- tabs:start -->

#### **cURL**

```bash
curl "https://api.trace.moe/anilist?q=Cowboy%20Bebop"
```

#### **javascript**

```javascript
await fetch("https://api.trace.moe/anilist?q=Cowboy%20Bebop").then((e) => e.json());
```

<!-- tabs:end -->

Example Response:

```json
[
  {
    "id": 1,
    "title": "Cowboy Bebop",
    "similarity": 1,
    "anilist": {
      "id": 1,
      "idMal": 1,
      "title": {
        "native": "カウボーイビバップ",
        "romaji": "Cowboy Bebop",
        "english": "Cowboy Bebop"
      },
      "synonyms": [],
      "isAdult": false
    }
  }
]
```

## /status (Unofficial)

Get server index status, total frame counts, Milvus vector row counts, memory and disk usage.

```bash
curl "https://api.trace.moe/status"
```

Example Response:

```json
{
  "updated": "2026-08-21T05:00:00.000Z",
  "rowCount": 52314500,
  "memory": 67108864000,
  "memoryUsage": 34108864000,
  "storage": 2000398934016,
  "storageFree": 823485002496,
  "storageAvailable": 723485002496,
  "mediaCount": 18240,
  "mediaFramesTotal": 52314500,
  "mediaDurationTotal": 2092580
}
```

You can also list all indexed files for a specific Anilist ID by appending `?id={anilist_id}`:

```bash
curl "https://api.trace.moe/status?id=1"
```

## /stats (Unofficial)

Query system-wide metrics over time (`traffic`, `speed` latency percentiles, or `accuracy`). Requires `type` and `period` (`minute`, `hour`, `day`).

```bash
curl "https://api.trace.moe/stats?type=traffic&period=hour"
curl "https://api.trace.moe/stats?type=speed&period=day"
curl "https://api.trace.moe/stats?type=accuracy&period=day"
```

## Using the API with API Keys

If you have an API Key that grants you more search quota and limits, put your API key in the HTTP header `x-trace-key`.

When searching with API Keys, it would count towards your account quota and limits. When searching without an API Key, you search as guests using your IP address.

### Using API Keys in HTTP header

<!-- tabs:start -->

#### **cURL**

```bash
curl -H "x-trace-key: xxxxxxxxxxxxxxxxxxxxxxx" "https://api.trace.moe/me"
```

#### **PowerShell**

```powershell
Invoke-RestMethod -Headers @{"x-trace-key" = "xxxxxxxxxxxxxxxxxxxxxxx"} https://api.trace.moe/me
```

#### **javascript**

```javascript
await fetch("https://api.trace.moe/me", {
  headers: {
    "x-trace-key": "xxxxxxxxxxxxxxxxxxxxxxx",
  },
}).then((e) => e.json());
```

#### **python**

```python
import requests
requests.get("https://api.trace.moe/me", headers={
  "x-trace-key": "xxxxxxxxxxxxxxxxxxxxxxx"
}).json()
```

<!-- tabs:end -->

### Using API Keys in query string (Deprecated)

For security reasons, putting API key in query string like `https://api.trace.moe/me?key=xxxxxxxxxxxxxxxxxxxxxxx` is no longer supported. Please use the `x-trace-key` header instead.
