import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import child_process from "node:child_process";
import fs from "node:fs/promises";
import aniep from "aniep";
import sharp from "sharp";
import { performance } from "node:perf_hooks";
import sql from "../sql.js";
import getSolrCoreList from "./lib/get-solr-core-list.js";

const {
  TRACE_API_SALT,
  TRACE_ACCURACY = 1,
  SEARCH_QUEUE = Infinity,
  USE_IMAGE_PROXY = false,
} = process.env;

const search = (image, candidates, anilistID) =>
  Promise.all(
    getSolrCoreList().map((coreURL) =>
      fetch(
        `${coreURL}/lireq?${[
          "field=cl_ha",
          "ms=false",
          `accuracy=${TRACE_ACCURACY}`,
          `candidates=${candidates}`,
          "rows=30",
          anilistID ? `fq=id:${anilistID}/*` : "",
        ].join("&")}`,
        {
          method: "POST",
          body: image,
        },
      ),
    ),
  );

const logAndDequeue = async (
  locals,
  ip,
  userId = null,
  priority,
  code,
  searchTime = null,
  accuracy = null,
) => {
  if (code === 200) {
    while (locals.mut) await new Promise((resolve) => setTimeout(resolve, 0));
    locals.mut = true;
    if (userId) {
      await sql`UPDATE users SET quota_used=quota_used+1 WHERE id=${userId}`;
    } else {
      await sql`INSERT INTO quota (ip, used) VALUES (${ip}, 1) ON CONFLICT(ip) DO UPDATE SET used = quota.used + 1`;
    }
    locals.mut = false;
  }
  await sql`INSERT INTO logs (created, ip, user_id, code, search_time, accuracy) VALUES (now(), ${ip}, ${userId}, ${code}, ${searchTime < 0 ? null : searchTime}, ${accuracy < 0 ? null : accuracy})`;

  const concurrentCount = locals.searchConcurrent.get(userId ?? ip) ?? 0;
  if (concurrentCount <= 1) locals.searchConcurrent.delete(userId ?? ip);
  else locals.searchConcurrent.set(userId ?? ip, concurrentCount - 1);

  locals.searchQueue[priority] = (locals.searchQueue[priority] || 1) - 1;
};

const extractImageByFFmpeg = async (searchFile) => {
  const tempFilePath = path.join(os.tmpdir(), `trace.moe-search-${process.hrtime().join("")}`);
  await fs.writeFile(tempFilePath, searchFile);
  const ffmpeg = child_process.spawnSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostats",
    "-y",
    "-i",
    tempFilePath,
    "-ss",
    "00:00:00",
    "-map_metadata",
    "-1",
    "-vf",
    "scale=320:-2",
    "-c:v",
    "mjpeg",
    "-vframes",
    "1",
    "-f",
    "image2pipe",
    "pipe:1",
  ]);
  await fs.rm(tempFilePath, { force: true });
  return ffmpeg.stdout;
};

const cutBorders = async (imageBuffer) => {
  const { width, height } = await sharp(imageBuffer).metadata();
  const { info } = await sharp(imageBuffer) // detect borders
    .trim({ background: "black", threshold: 20 })
    .toBuffer({ resolveWithObject: true });

  const trimmedTop = Math.abs(info.trimOffsetTop);
  const trimmedBottom = height - info.height - trimmedTop;
  const borderHeight = Math.max(trimmedTop, trimmedBottom);
  const newWidth = info.width;
  const newHeight = height - borderHeight * 2;
  // cut top and bottom equally using the thickest border
  // cut left and right as detected
  if (width / height < 1.78 && newWidth / newHeight > 2.3) {
    // if the original image is taller than 16:9 and new image is 21:9 wide
    return await sharp(imageBuffer)
      .extract({
        left: Math.abs(info.trimOffsetLeft),
        top: borderHeight,
        width: newWidth,
        height: newHeight,
      })
      .resize({ width: 320, height: 180, fit: "contain" }) // fill it back to 16:9
      .jpeg()
      .toBuffer();
  }
  return await sharp(imageBuffer)
    .extract({
      left: Math.abs(info.trimOffsetLeft),
      top: borderHeight,
      width: newWidth,
      height: newHeight,
    })
    .jpeg()
    .toBuffer();
};

export default async (req, res) => {
  const locals = req.app.locals;

  const [defaultTier] = await sql`SELECT concurrency, quota, priority FROM tiers WHERE id=0`;
  let quota = defaultTier.quota;
  let quotaUsed = 0;
  let concurrency = defaultTier.concurrency;
  let priority = defaultTier.priority;
  let userId = null;
  const apiKey = req.query.key ?? req.header("x-trace-key") ?? "";
  if (apiKey) {
    const [user] =
      await sql`SELECT id, quota, quota_used, concurrency, priority FROM users_view WHERE api_key=${apiKey}`;
    if (!user) {
      return res.status(403).json({
        error: "Invalid API key",
      });
    }
    if (user.id >= 1000) {
      quota = user.quota;
      quotaUsed = user.quota_used;
      concurrency = user.concurrency;
      priority = user.priority;
      userId = user.id;
    } else {
      // system accounts
      userId = req.query.uid ?? user.id;
    }
  } else {
    const [quota] = await sql`SELECT used FROM quota WHERE ip=${req.ip}`;
    quotaUsed = quota?.used ?? 0;
  }

  if (quotaUsed >= quota) {
    await logAndDequeue(locals, req.ip, userId, priority, 402);
    return res.status(402).json({
      error: "Search quota depleted",
    });
  }

  locals.searchConcurrent.set(
    userId ?? req.ip,
    (locals.searchConcurrent.get(userId ?? req.ip) ?? 0) + 1,
  );
  if (locals.searchConcurrent.get(userId ?? req.ip) > concurrency) {
    await logAndDequeue(locals, req.ip, userId, priority, 402);
    return res.status(402).json({
      error: "Concurrency limit exceeded",
    });
  }

  locals.searchQueue[priority] = (locals.searchQueue[priority] ?? 0) + 1;
  const queueSize = locals.searchQueue.reduce((acc, cur, i) => (i >= priority ? acc + cur : 0), 0);

  if (queueSize > SEARCH_QUEUE) {
    await logAndDequeue(locals, req.ip, userId, priority, 503);
    return res.status(503).json({
      error: `Error: Search queue is full`,
    });
  }

  let searchFile = new Buffer.alloc(0);
  if (req.query.url) {
    // console.log(req.query.url);
    try {
      new URL(req.query.url);
    } catch (e) {
      await logAndDequeue(locals, req.ip, userId, priority, 400);
      return res.status(400).json({
        error: `Invalid image url ${req.query.url}`,
      });
    }

    const response = await fetch(
      USE_IMAGE_PROXY &&
        ![
          // list of trusted hostnames that you don't mind exposing your server's ip address
          "api.telegram.org",
          "telegra.ph",
          "t.me",
          "discord.com",
          "cdn.discordapp.com",
          "media.discordapp.net",
          "images-ext-1.discordapp.net",
          "images-ext-2.discordapp.net",
        ].includes(new URL(req.query.url).hostname)
        ? `https://trace.moe/image-proxy?url=${encodeURIComponent(req.query.url)}`
        : req.query.url,
    ).catch((_) => {
      return { status: 400 };
    });
    if (response.status >= 400) {
      await logAndDequeue(locals, req.ip, userId, priority, 400);
      return res.status(response.status).json({
        error: `Failed to fetch image ${req.query.url}`,
      });
    }
    searchFile = Buffer.from(await response.arrayBuffer());
  } else if (req.files?.length) {
    searchFile = req.files[0].buffer;
  } else if (req.rawBody?.length) {
    searchFile = req.rawBody;
  } else {
    await logAndDequeue(locals, req.ip, userId, priority, 405);
    return res.status(405).json({
      error: "Method Not Allowed",
    });
  }

  const searchImagePNG = await sharp(searchFile)
    .resize({ width: 320, height: 320, fit: "inside" })
    .toBuffer()
    .catch(async () => await extractImageByFFmpeg(searchFile));

  if (!searchImagePNG.length) {
    await logAndDequeue(locals, req.ip, userId, priority, 400);
    return res.status(400).json({
      error: "Failed to process image",
    });
  }

  const searchImage =
    "cutBorders" in req.query
      ? await cutBorders(searchImagePNG)
      : await sharp(searchImagePNG).jpeg().toBuffer();

  let candidates = 1000000;
  const startTime = performance.now();
  let solrResponse = null;
  try {
    solrResponse = await search(searchImage, candidates, Number(req.query.anilistID));
  } catch (e) {
    await logAndDequeue(locals, req.ip, userId, priority, 503);
    return res.status(503).json({
      error: `Error: Database is not responding`,
    });
  }
  if (solrResponse.find((e) => e.status >= 500)) {
    const r = solrResponse.find((e) => e.status >= 500);
    await logAndDequeue(locals, req.ip, userId, priority, r.status);
    return res.status(r.status).json({
      error: `Database is ${r.status === 504 ? "overloaded" : "offline"}`,
    });
  }
  let solrResults = await Promise.all(solrResponse.map((e) => e.json()));

  const maxRawDocsCount = Math.max(...solrResults.map((e) => Number(e.RawDocsCount)));
  if (maxRawDocsCount > candidates) {
    // found cluster has more candidates than expected
    // search again with increased candidates count
    candidates = maxRawDocsCount;
    solrResponse = await search(searchImage, candidates, Number(req.query.anilistID));
    if (solrResponse.find((e) => e.status >= 500)) {
      const r = solrResponse.find((e) => e.status >= 500);
      await logAndDequeue(locals, req.ip, userId, priority, r.status);
      return res.status(r.status).json({
        error: `Database is ${r.status === 504 ? "overloaded" : "offline"}`,
      });
    }
    solrResults = await Promise.all(solrResponse.map((e) => e.json()));
  }
  const searchTime = (performance.now() - startTime) | 0;

  let result = [];
  let frameCountList = [];

  if (solrResults.find((e) => e.Error)) {
    console.log(solrResults.find((e) => e.Error));
    await logAndDequeue(locals, req.ip, userId, priority, 500);
    return res.status(500).json({
      error: solrResults.find((e) => e.Error).Error,
    });
  }

  for (const { RawDocsCount, response } of solrResults) {
    frameCountList.push(Number(RawDocsCount));
    result = result.concat(response.docs);
  }

  result = result
    .reduce((list, { d, id }) => {
      // merge nearby results within 5 seconds in the same filename
      const anilist_id = Number(id.split("/")[0]);
      const filename = id.split("/")[1];
      const t = Number(id.split("/")[2]);
      const index = list.findIndex(
        (e) =>
          e.anilist_id === anilist_id &&
          e.filename === filename &&
          (Math.abs(e.from - t) < 5 || Math.abs(e.to - t) < 5),
      );
      if (index < 0) {
        return list.concat({
          anilist_id,
          filename,
          t,
          from: t,
          to: t,
          d,
        });
      } else {
        list[index].from = list[index].from < t ? list[index].from : t;
        list[index].to = list[index].to > t ? list[index].to : t;
        list[index].d = list[index].d < d ? list[index].d : d;
        list[index].t = list[index].d < d ? list[index].t : t;
        return list;
      }
    }, [])
    .sort((a, b) => a.d - b.d) // sort in ascending order of difference
    .slice(0, 10); // return only top 10 results

  const window = 60 * 60; // 3600 seconds
  const now = ((Date.now() / 1000 / window) | 0) * window + window;
  result = result.map(({ anilist_id, filename, t, from, to, d }) => {
    const mid = from + (to - from) / 2;
    const videoToken = crypto
      .createHash("sha1")
      .update([anilist_id, filename, mid, now, TRACE_API_SALT].join(""))
      .digest("base64")
      .replace(/[^0-9A-Za-z]/g, "");
    const imageToken = crypto
      .createHash("sha1")
      .update([anilist_id, filename, mid, now, TRACE_API_SALT].join(""))
      .digest("base64")
      .replace(/[^0-9A-Za-z]/g, "");

    return {
      anilist: anilist_id,
      filename,
      episode: aniep(filename),
      from,
      to,
      similarity: (100 - d) / 100,
      video: `${req.protocol}://${req.get("host")}/video/${anilist_id}/${encodeURIComponent(filename)}?${[
        `t=${mid}`,
        `now=${now}`,
        `token=${videoToken}`,
      ].join("&")}`,
      image: `${req.protocol}://${req.get("host")}/image/${anilist_id}/${encodeURIComponent(filename)}?${[
        `t=${mid}`,
        `now=${now}`,
        `token=${imageToken}`,
      ].join("&")}`,
    };
  });

  if ("anilistInfo" in req.query) {
    const anilist =
      await sql`SELECT * FROM anilist WHERE id IN ${sql(result.map((e) => e.anilist))}`;
    result = result.map((entry) => {
      entry.anilist = anilist.find((e) => e.id === entry.anilist).json;
      return entry;
    });
  }

  await logAndDequeue(
    locals,
    req.ip,
    userId,
    priority,
    200,
    searchTime,
    result[0]?.similarity ?? 0,
  );

  res.json({
    frameCount: frameCountList.reduce((prev, curr) => prev + curr, 0),
    error: "",
    result,
  });
};
