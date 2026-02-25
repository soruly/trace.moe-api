import crypto from "node:crypto";
import os from "node:os";
import { performance } from "node:perf_hooks";

import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import aniep from "aniep";

import sql from "../sql.ts";
import colorLayout from "./lib/color-layout.ts";
import prepareSearchImage from "./lib/prepare-search-image.ts";
import safeFetch from "./lib/safe-fetch.ts";

const {
  TRACE_API_SALT,
  SEARCH_QUEUE,
  IMAGE_PROXY_URL = "",
  MILVUS_ADDR,
  MILVUS_TOKEN,
} = process.env;

const TRUSTED_PROXY_HOSTS = new Set([
  // list of trusted hostnames to always fetch directly without proxy
  "api.telegram.org",
  "telegra.ph",
  "t.me",
  "discord.com",
  "cdn.discordapp.com",
  "media.discordapp.net",
  "images-ext-1.discordapp.net",
  "images-ext-2.discordapp.net",
]);

const maxQueueSize = SEARCH_QUEUE ? Number(SEARCH_QUEUE) : os.availableParallelism();

const ipQuotaMap = new Map<string, number[]>();
// check and delete search records older than 24 hours every 60 minutes
setInterval(
  () => {
    const threshold = Date.now() - 24 * 60 * 60 * 1000;
    for (const [ip, timestamps] of ipQuotaMap) {
      let expired = 0;
      while (expired < timestamps.length && timestamps[expired] <= threshold) expired++;
      if (expired === timestamps.length) ipQuotaMap.delete(ip);
      else if (expired > 0) timestamps.splice(0, expired);
    }
  },
  60 * 60 * 1000,
).unref();

const milvus = new MilvusClient({ address: MILVUS_ADDR, token: MILVUS_TOKEN });

const logAndDequeue = async (
  locals,
  ip,
  userId = null,
  concurrentId,
  priority,
  code,
  searchTime = null,
  accuracy = null,
) => {
  await sql`
    INSERT INTO
      logs (created, ip, user_id, code, search_time, accuracy)
    VALUES
      (
        now(),
        ${ip},
        ${userId},
        ${code},
        ${searchTime < 0 ? null : searchTime},
        ${accuracy < 0 ? null : accuracy}
      )
  `;

  if (code === 200 && !userId) {
    let timestamps = ipQuotaMap.get(concurrentId);
    if (!timestamps) {
      timestamps = [];
      ipQuotaMap.set(concurrentId, timestamps);
    }
    timestamps.push(Date.now());
  }

  const concurrentCount = locals.searchConcurrent.get(concurrentId) ?? 0;
  if (concurrentCount <= 1) locals.searchConcurrent.delete(concurrentId);
  else locals.searchConcurrent.set(concurrentId, concurrentCount - 1);

  locals.searchQueue[priority] = (locals.searchQueue[priority] || 1) - 1;
};

const [tier0] = await sql`
  SELECT
    quota,
    concurrency,
    priority
  FROM
    tiers
  WHERE
    id = 0
`;

const [tier9User] = await sql`
  SELECT
    id,
    api_key,
    quota,
    concurrency,
    priority
  FROM
    users_view
  WHERE
    tier = 9
  LIMIT
    1
`;
const superUserKeyBuffer = tier9User ? Buffer.from(tier9User.api_key) : null;

export default async (req, res) => {
  const locals = req.app.locals;
  const apiKey = req.header("x-trace-key");

  let concurrency = tier0.concurrency;
  let priority = tier0.priority;
  let quota = tier0.quota;
  let quotaUsed = 0;
  let userId = null;
  let concurrentId = req.ip;
  if (apiKey) {
    const apiKeyBuffer = Buffer.from(apiKey);
    if (
      superUserKeyBuffer &&
      apiKeyBuffer.length === superUserKeyBuffer.length &&
      crypto.timingSafeEqual(apiKeyBuffer, superUserKeyBuffer)
    ) {
      quota = tier9User.quota;
      concurrency = tier9User.concurrency;
      priority = tier9User.priority;
      userId = tier9User.id;
      concurrentId = tier9User.id;
    } else {
      const [user] = await sql`
        SELECT
          id,
          quota,
          quota_used,
          concurrency,
          priority
        FROM
          users_view
        WHERE
          api_key = ${apiKey}
      `;
      if (!user) {
        return res.status(403).json({
          error: "Invalid API key",
        });
      }
      quota = user.quota;
      quotaUsed = user.quota_used;
      concurrency = user.concurrency;
      priority = user.priority;
      userId = user.id;
      concurrentId = user.id;
    }
  } else {
    concurrentId = req.ip.includes(":") ? req.ip.split(":").slice(0, 4).join(":") : req.ip;

    const timestamps = ipQuotaMap.get(concurrentId);
    if (timestamps) {
      // exclude search records older than 24 hours
      const threshold = Date.now() - 24 * 60 * 60 * 1000;
      let expired = 0;
      while (expired < timestamps.length && timestamps[expired] <= threshold) expired++;
      if (expired > 0) timestamps.splice(0, expired);
      quotaUsed = timestamps.length;
    }
  }

  locals.searchConcurrent.set(concurrentId, (locals.searchConcurrent.get(concurrentId) ?? 0) + 1);
  locals.searchQueue[priority] = (locals.searchQueue[priority] ?? 0) + 1;

  if (quotaUsed >= quota) {
    logAndDequeue(locals, req.ip, userId, concurrentId, priority, 402);
    return res.status(402).json({
      error: `Search quota depleted (quota per 24 hours: ${quota}, used: ${quotaUsed})`,
    });
  }

  if (locals.searchConcurrent.get(concurrentId) > concurrency) {
    logAndDequeue(locals, req.ip, userId, concurrentId, priority, 402);
    return res.status(402).json({
      error: "Concurrency limit exceeded",
    });
  }

  const queueSize = locals.searchQueue.reduce((acc, cur, i) => (i >= priority ? acc + cur : 0), 0);

  if (queueSize > maxQueueSize) {
    logAndDequeue(locals, req.ip, userId, concurrentId, priority, 503);
    return res.status(503).json({
      error: `Error: Search queue is full`,
    });
  }

  let searchFile;
  if (req.query.url) {
    const imageURL = String(req.query.url);
    try {
      new URL(imageURL);
    } catch (e) {
      logAndDequeue(locals, req.ip, userId, concurrentId, priority, 400);
      return res.status(400).json({
        error: `Invalid image url ${imageURL}`,
      });
    }

    const useProxy = IMAGE_PROXY_URL && !TRUSTED_PROXY_HOSTS.has(new URL(imageURL).hostname);

    console.log(`Fetching image ${useProxy ? "with proxy" : "directly"} ${imageURL}`);

    const response = await safeFetch(
      useProxy ? `${IMAGE_PROXY_URL}?url=${encodeURIComponent(imageURL)}` : imageURL,
    ).catch((e: Error) => {
      console.error(e);
      return null;
    });
    if (!response || response.status >= 400) {
      logAndDequeue(locals, req.ip, userId, concurrentId, priority, 400);
      return res.status(response?.status ?? 400).json({
        error: `Failed to fetch image ${imageURL}`,
      });
    }
    searchFile = Buffer.from(await response.arrayBuffer());
  } else if (req.files?.length) {
    searchFile = req.files[0].buffer;
  } else if (req.rawBody?.length) {
    searchFile = req.rawBody;
  } else {
    logAndDequeue(locals, req.ip, userId, concurrentId, priority, 405);
    return res.status(405).json({
      error: "Method Not Allowed",
    });
  }

  if (!searchFile.length) {
    logAndDequeue(locals, req.ip, userId, concurrentId, priority, 400);
    return res.status(400).json({
      error: "Failed to process file",
    });
  }

  let expr = null;
  let exprValues = null;
  if (req.query.anilistID?.match(/^\d+$/)) {
    const files = await sql`
      SELECT
        id
      FROM
        files
      WHERE
        anilist_id = ${Number(req.query.anilistID)}
    `;

    if (files.length === 0) {
      logAndDequeue(locals, req.ip, userId, concurrentId, priority, 200, 0, 0);
      return res.json({
        frameCount: 0,
        error: "",
        result: [],
      });
    }

    expr = "file_id IN {list}";
    exprValues = { list: files.map((e) => e.id) };
  }

  const searchImage = await prepareSearchImage(searchFile, "cutBorders" in req.query);

  if (!searchImage) {
    logAndDequeue(locals, req.ip, userId, concurrentId, priority, 400);
    return res.status(400).json({
      error: "Failed to process image",
    });
  }

  const startTime = performance.now();

  const searchResult = await milvus.search({
    collection_name: "frame_color_layout",
    data: colorLayout(searchImage.data, searchImage.info.width, searchImage.info.height),
    limit: 1000,
    expr,
    exprValues,
    output_fields: ["file_id", "time"],
  });
  const searchTime = (performance.now() - startTime) | 0;

  // merge results from same file where time is within 5 seconds
  const list = [];
  const fileMap = new Map();
  const sortedResults = [...searchResult.results].sort((a, b) => a.time - b.time);

  for (const { score, file_id, time } of sortedResults) {
    let entries = fileMap.get(file_id);
    if (!entries) {
      entries = [];
      fileMap.set(file_id, entries);
    }
    let match = null;
    if (entries.length > 0) {
      const lastEntry = entries[entries.length - 1];
      if (Math.abs(lastEntry.to - time) < 5 || Math.abs(lastEntry.from - time) < 5) {
        match = lastEntry;
      }
    }
    if (!match) {
      const newEntry = {
        file_id,
        at: time,
        from: time,
        to: time,
        score,
      };
      entries.push(newEntry);
      list.push(newEntry);
    } else {
      match.from = match.from < time ? match.from : time;
      match.to = match.to > time ? match.to : time;
      if (score < match.score) {
        match.score = score;
        match.at = time;
      }
    }
  }

  let result = list
    .sort((a, b) => a.score - b.score) // sort in ascending order of difference
    .slice(0, 10); // return only top 10 results

  if (result.length === 0) {
    logAndDequeue(locals, req.ip, userId, concurrentId, priority, 200, searchTime, 0);
    return res.json({
      frameCount: Number(searchResult.all_search_count),
      error: "",
      result: [],
    });
  }

  const files = await sql`
    SELECT
      id,
      anilist_id,
      path,
      duration
    FROM
      files
    WHERE
      id IN ${sql(Array.from(new Set(result.map((e) => e.file_id))))}
  `;

  const filesMap = new Map();
  for (const f of files) filesMap.set(f.id, f);

  const window = 60 * 60; // snap to nearest hour for better cache
  const expire = ((Date.now() / 1000 / window) | 0) * window + window;
  const saltBuffer = Buffer.from(TRACE_API_SALT);

  result = result
    .filter((e) => filesMap.has(e.file_id))
    .map(({ file_id, at, from, to, score }) => {
      const { anilist_id, path, duration } = filesMap.get(file_id);

      const time = (at * 10000) | 0; // convert 4dp time code to integer
      const buf = Buffer.allocUnsafe(saltBuffer.length);
      saltBuffer.copy(buf);
      buf.writeUInt32LE(Math.abs(time ^ expire ^ file_id), 0);
      const hash = crypto.createHash("sha1").update(buf).digest().readUInt32LE(0);
      const previewId = locals.sqids.encode([file_id, time, expire, hash]);

      return {
        anilist: anilist_id,
        filename: path.split("/").pop(),
        episode: aniep(path.split("/").pop()),
        from: Number(from.toFixed(4)),
        at: Number(at.toFixed(4)),
        to: Number(to.toFixed(4)),
        duration,
        similarity: Math.min(Math.max(0, (255 - score) / 255), 1),
        video: `${req.protocol}://${req.get("host")}/video/${previewId}`,
        image: `${req.protocol}://${req.get("host")}/image/${previewId}`,
      };
    });

  if ("anilistInfo" in req.query) {
    const anilist = await sql`
      SELECT
        *
      FROM
        anilist
      WHERE
        id IN ${sql(Array.from(new Set(result.map((e) => e.anilist))))}
    `;
    const anilistMap = new Map();
    for (const a of anilist) anilistMap.set(a.id, a);

    result = result.map((entry) => {
      entry.anilist = anilistMap.get(entry.anilist)?.json ?? entry.anilist;
      return entry;
    });
  }

  logAndDequeue(
    locals,
    req.ip,
    userId,
    concurrentId,
    priority,
    200,
    searchTime,
    result[0]?.similarity ?? 0,
  );

  res.json({
    frameCount: Number(searchResult.all_search_count),
    error: "",
    result,
  });
};
