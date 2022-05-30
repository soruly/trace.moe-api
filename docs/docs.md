# API Docs

You may also refer to swagger docs on [SwaggerHub](https://app.swaggerhub.com/apis/soruly/api.trace.moe/1.0.0#/)

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
    "https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg"
  )}`
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
import fs from "fs";
import fetch from "node-fetch";
await fetch("https://api.trace.moe/search", {
  method: "POST",
  body: fs.readFileSync("demo.jpg"),
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

Supported Content-Types are `image/*`, `video/*`, `application/octet-stream` and `application/x-www-form-urlencoded`

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

### Cut Black Borders

trace.moe can detect black borders automatically and cut away unnecessary parts of the images that would affect search results accuracy. This is useful if your image is a screencap from a smartphone or iPad that contains black bars.

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
    "https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg"
  )}`
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

First you have to look for the Anilist ID of your anime from [AniList](https://anilist.co/) first. Then add `anilistID=1` to the query string. e.g. Anilist ID of Cowboy Bebop is 1

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
    "https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg"
  )}`
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

trace.moe support any media format that can be decoded by [ffmpeg](https://www.ffmpeg.org/), including video and gif. When using video / gif, only the 1st frame would be extracted for searching.

Your image / video must be smaller than 10MB. Otherwise it would fail with HTTP 413 (Request Entity Too Large).

The recommended resolution is 640 x 360px, higher resolution doesn't yield better search results. The algorithm is also resistant to jpeg artifacts, so you don't have to use uncompressed formats like png.

### Response format

```json
{
  "frameCount": 745506,
  "error": "",
  "result": [
    {
      "anilist": 99939,
      "filename": "Nekopara - OVA (BD 1280x720 x264 AAC).mp4",
      "episode": null,
      "from": 97.75,
      "to": 98.92,
      "similarity": 0.9440424588727485,
      "video": "https://media.trace.moe/video/99939/Nekopara%20-%20OVA%20(BD%201280x720%20x264%20AAC).mp4?t=98.335&now=1653892514&token=xxxxxxxxxxxxxx",
      "image": "https://media.trace.moe/image/99939/Nekopara%20-%20OVA%20(BD%201280x720%20x264%20AAC).mp4.jpg?t=98.335&now=1653892514&token=xxxxxxxxxxxxxx"
    }
  ]
}
```

| Fields     | Meaning                          | Value            |
| ---------- | -------------------------------- | ---------------- |
| frameCount | Total number of frames searched  | number           |
| error      | Error message                    | string           |
| result     | Search results (see table below) | Array of Objects |

| Fields     | Meaning                                        | Value                                             |
| ---------- | ---------------------------------------------- | ------------------------------------------------- |
| anilist    | The matching Anilist ID or Anilist info        | number or object                                  |
| filename   | The filename of file where the match is found  | string                                            |
| episode    | The extracted episode number from filename     | Refer to [aniep](https://github.com/soruly/aniep) |
| from       | Starting time of the matching scene (seconds)  | number                                            |
| to         | Ending time of the matching scene (seconds)    | number                                            |
| similarity | Similarity compared to the search image        | number (0 to 1)                                   |
| video      | URL to the preview video of the matching scene | string                                            |
| image      | URL to the preview image of the matching scene | string                                            |

- Results are sorted from most similar to least similar
- Similarity lower than 90% are most likely incorrect results. It's up to you to judge what is a match and what is just visually similar.
- `episode` can be null because it is just a result of parsing the `filename` with [aniep](https://github.com/soruly/aniep)

By default, it only returns Anilist ID for search results. To get more anime info, make a second query to [AniList API](https://github.com/AniList/ApiV2-GraphQL-Docs). If you need chinese-translated titles, take a look at [anilist-chinese](https://github.com/soruly/anilist-chinese)

### Include Anilist info

Asking for Anilist info would slow down your request because it takes additional query to Anilist, and may fail depending on their availability.

Only ask for it when you need nothing more than `idMal`, `title`, `synonyms`, `isAdult` from Anilist, you can add `anilistInfo` to query string. e.g.

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
    "https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg"
  )}`
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
      "from": 97.75,
      "to": 98.92,
      "similarity": 0.9440424588727485,
      "video": "https://media.trace.moe/video/99939/Nekopara%20-%20OVA%20(BD%201280x720%20x264%20AAC).mp4?t=98.335&now=1653892514&token=xxxxxxxxxxxxxx",
      "image": "https://media.trace.moe/image/99939/Nekopara%20-%20OVA%20(BD%201280x720%20x264%20AAC).mp4.jpg?t=98.335&now=1653892514&token=xxxxxxxxxxxxxx"
    }
  ]
}
```

The data inside the anilist object is an unmodified response from Anilist API. These data are managed by Anilist and they may change or delete these entries anytime.

Some title variants would be null. Please read [this section on Anilist API Docs](https://anilist.gitbook.io/anilist-apiv2-docs/overview/migrating-from-apiv1#media-titles) for explanations. It is recommended to have some fallback when selecting your preferred title.

### Media Preview

The url you obtained from `image` and `video` from search result is served by [trace.moe-media](https://github.com/soruly/trace.moe-media)

> These urls would expire in 300 seconds (5 minutes)

It can generate image or video preview of 3 sizes by appending `size=l` (large), `size=m` (medium, default) or `size=s` (small) at the end of the url. e.g.

```
https://media.trace.moe/image/xxx/xxxxxx.mp4.jpg?t=0&now=1653892514&token=xxxxx&size=s
https://media.trace.moe/video/xxx/xxxxxx.mp4?t=0&now=1653892514&token=xxxxx&size=s
```

For video preview, it can generate a video with sound (default), or a muted video by appending `mute` to the end of url. e.g.

```
https://media.trace.moe/video/xxx/xxxxxx.mp4?t=0&now=1653892514&token=xxxxx&mute
https://media.trace.moe/video/xxx/xxxxxx.mp4?t=0&now=1653892514&token=xxxxx&size=s&mute
```

The media server would detect boundaries of the scene and cut videos at the boundaries. You cannot specify the length of video preview.

> Do not attempt to parse and modify the urls except documented above. The urls are not permanent and may change without notice.

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
| quota       | Search quota you have for this month            | number             |
| quotaUsed   | Search quota you have used this month           | number             |

## Using the API with API Keys

If you have an API Key that grants you more search quota and limits, put your API key in either HTTP header `x-trace-key` or query string `key`.

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

### Using API Keys in query string

If you're lazy and don't mind your API Key being exposed to browser history or logs. Just put your key in key in query string

<!-- tabs:start -->

#### **cURL**

```bash
curl "https://api.trace.moe/me?key=xxxxxxxxxxxxxxxxxxxxxxx"
```

#### **PowerShell**

```powershell
Invoke-RestMethod "https://api.trace.moe/me?key=xxxxxxxxxxxxxxxxxxxxxxx"
```

#### **javascript**

```javascript
await fetch("https://api.trace.moe/me?key=xxxxxxxxxxxxxxxxxxxxxxx").then((e) => e.json());
```

#### **python**

```python
import requests
requests.get("https://api.trace.moe/me?key=xxxxxxxxxxxxxxxxxxxxxxx").json()
```

<!-- tabs:end -->
