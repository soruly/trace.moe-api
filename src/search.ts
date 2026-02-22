import crypto from "node:crypto";
import os from "node:os";
import path from "node:path";
import child_process from "node:child_process";
import fs from "node:fs/promises";
import aniep from "aniep";
import sharp from "sharp";
import { performance } from "node:perf_hooks";
import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import sql from "../sql.ts";
import colorLayout from "./lib/color-layout.ts";

const {
  TRACE_API_SALT,
  SEARCH_QUEUE = Infinity,
  IMAGE_PROXY_URL = "",
  MILVUS_ADDR,
  MILVUS_TOKEN,
} = process.env;

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
  if (code === 200) {
    while (locals.mut) await new Promise((resolve) => setTimeout(resolve, 0));
    locals.mut = true;
    if (userId) {
      await sql`
        UPDATE users
        SET
          quota_used = quota_used + 1
        WHERE
          id = ${userId}
      `;
    } else {
      await sql`
        INSERT INTO
          quota (ip, used)
        VALUES
          (${ip}, 1)
        ON CONFLICT (ip) DO UPDATE
        SET
          used = quota.used + 1
      `;
    }
    locals.mut = false;
  }
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

  const concurrentCount = locals.searchConcurrent.get(concurrentId) ?? 0;
  if (concurrentCount <= 1) locals.searchConcurrent.delete(concurrentId);
  else locals.searchConcurrent.set(concurrentId, concurrentCount - 1);

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
    "png",
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
  // normalize brightness -> blur away UI controls -> trim with certain dark threshold
  const { info } = await sharp(await sharp(imageBuffer).normalize().dilate(2).toBuffer())
    .trim({ background: "black", threshold: 30 })
    .toBuffer({ resolveWithObject: true });

  const trimmedTop = Math.abs(info.trimOffsetTop);
  const trimmedLeft = Math.abs(info.trimOffsetLeft);
  const newWidth = info.width;
  const newHeight = info.height;
  if (
    Math.abs(newWidth / newHeight - 16 / 9) < 0.05 ||
    Math.abs(newWidth / newHeight - 4 / 3) < 0.05
  ) {
    // if detected area is near 16:9 or 4:3, crop as detected
    return await sharp(imageBuffer)
      .extract({
        left: trimmedLeft,
        top: trimmedTop,
        width: newWidth,
        height: newHeight,
      })
      .flatten({ background: "#000000" })
      .raw()
      .toBuffer({ resolveWithObject: true });
  } else if (Math.abs(newWidth / newHeight - 21 / 9) < 0.1) {
    // if detected area is near 21:9
    const { width, height } = await sharp(imageBuffer).metadata();
    if ((width - newWidth) / width > 0.05 || (height - newHeight) / height > 0.05) {
      // and detected area is smaller than original, crop and fill it back to 16:9
      return await sharp(imageBuffer)
        .extract({
          left: trimmedLeft,
          top: trimmedTop,
          width: newWidth,
          height: newHeight,
        })
        .resize({ width: 320, height: 180, fit: "contain" })
        .flatten({ background: "#000000" })
        .raw()
        .toBuffer({ resolveWithObject: true });
    }
  }
  // if detected area is not standard aspect ratio, do no crop
  // if detected area is 21:9 and original is also 21:9, do no crop
  return sharp(imageBuffer)
    .flatten({ background: "#000000" })
    .raw()
    .toBuffer({ resolveWithObject: true });
};

export default async (req, res) => {
  const locals = req.app.locals;

  const [defaultTier] = await sql`
    SELECT
      concurrency,
      quota,
      priority
    FROM
      tiers
    WHERE
      id = 0
  `;
  let quota = defaultTier.quota;
  let quotaUsed = 0;
  let concurrency = defaultTier.concurrency;
  let priority = defaultTier.priority;
  let userId = null;
  const apiKey = req.query.key ?? req.header("x-trace-key") ?? "";
  if (apiKey) {
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
  } else {
    const [row] = await sql`
      SELECT
        network,
        SUM(used) AS used
      FROM
        quota
      WHERE
        network = CASE
          WHEN family(${req.ip}) = 6 THEN set_masklen(${req.ip}::cidr, 56)
          ELSE set_masklen(${req.ip}::cidr, 32)
        END
      GROUP BY
        network
    `;
    quotaUsed = row?.used ?? 0;
  }

  const concurrentId =
    userId ??
    (
      await sql`
        SELECT
          CASE
            WHEN family(${req.ip}) = 6 THEN set_masklen(${req.ip}::cidr, 56)
            ELSE set_masklen(${req.ip}::cidr, 32)
          END AS network
      `
    )[0]?.network ??
    req.ip;

  if (quotaUsed >= quota) {
    await logAndDequeue(locals, req.ip, userId, concurrentId, priority, 402);
    return res.status(402).json({
      error: "Search quota depleted",
    });
  }

  locals.searchConcurrent.set(concurrentId, (locals.searchConcurrent.get(concurrentId) ?? 0) + 1);
  if (locals.searchConcurrent.get(concurrentId) > concurrency) {
    await logAndDequeue(locals, req.ip, userId, concurrentId, priority, 402);
    return res.status(402).json({
      error: "Concurrency limit exceeded",
    });
  }

  locals.searchQueue[priority] = (locals.searchQueue[priority] ?? 0) + 1;
  const queueSize = locals.searchQueue.reduce((acc, cur, i) => (i >= priority ? acc + cur : 0), 0);

  if (queueSize > SEARCH_QUEUE) {
    await logAndDequeue(locals, req.ip, userId, concurrentId, priority, 503);
    return res.status(503).json({
      error: `Error: Search queue is full`,
    });
  }

  let searchFile;
  if (req.query.url) {
    // console.log(req.query.url);
    try {
      new URL(req.query.url);
    } catch (e) {
      await logAndDequeue(locals, req.ip, userId, concurrentId, priority, 400);
      return res.status(400).json({
        error: `Invalid image url ${req.query.url}`,
      });
    }

    const response = await fetch(
      IMAGE_PROXY_URL &&
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
        ? `${IMAGE_PROXY_URL}?url=${encodeURIComponent(req.query.url)}`
        : req.query.url,
    ).catch((_) => {
      return null;
    });
    if (!response || response.status >= 400) {
      await logAndDequeue(locals, req.ip, userId, concurrentId, priority, 400);
      return res.status(response?.status ?? 400).json({
        error: `Failed to fetch image ${req.query.url}`,
      });
    }
    searchFile = Buffer.from(await response.arrayBuffer());
  } else if (req.files?.length) {
    searchFile = req.files[0].buffer;
  } else if (req.rawBody?.length) {
    searchFile = req.rawBody;
  } else {
    await logAndDequeue(locals, req.ip, userId, concurrentId, priority, 405);
    return res.status(405).json({
      error: "Method Not Allowed",
    });
  }

  const searchImageResized = await sharp(searchFile)
    .resize({ width: 320, height: 320, fit: "inside" })
    .toBuffer()
    .catch(async () => await extractImageByFFmpeg(searchFile));

  if (!searchImageResized.length) {
    await logAndDequeue(locals, req.ip, userId, concurrentId, priority, 400);
    return res.status(400).json({
      error: "Failed to process image",
    });
  }

  const searchImage =
    "cutBorders" in req.query
      ? await cutBorders(searchImageResized)
      : await sharp(searchImageResized)
          .flatten({ background: "#000000" })
          .raw()
          .toBuffer({ resolveWithObject: true });

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
    expr = "file_id IN {list}";
    exprValues = { list: files.map((e) => e.id) };
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
  for (const { score, file_id, time } of searchResult.results) {
    let entries = fileMap.get(file_id);
    if (!entries) {
      entries = [];
      fileMap.set(file_id, entries);
    }
    let match = null;
    for (const entry of entries) {
      if (Math.abs(entry.from - time) < 5 || Math.abs(entry.to - time) < 5) {
        match = entry;
        break;
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
      match.score = match.score < score ? match.score : score;
      match.at = match.score < score ? match.at : time;
    }
  }

  let result = list
    .sort((a, b) => a.score - b.score) // sort in ascending order of difference
    .slice(0, 10); // return only top 10 results

  const files = await sql`
    SELECT
      id,
      anilist_id,
      path,
      duration
    FROM
      files
    WHERE
      id IN ${sql(result.map((e) => e.file_id))}
  `;

  const window = 60 * 60; // snap to nearest hour for better cache
  const expire = ((Date.now() / 1000 / window) | 0) * window + window;
  result = result
    .filter((e) => files.find((f) => f.id === e.file_id))
    .map(({ file_id, at, from, to, score }) => {
      const { anilist_id, path, duration } = files.find((f) => f.id === file_id);

      const time = (at * 10000) | 0; // convert 4dp time code to integer
      const buf = Buffer.from(TRACE_API_SALT);
      buf.writeUInt32LE(Math.abs(time ^ expire ^ file_id));
      const hash = Buffer.from(
        crypto.createHash("sha1").update(buf).digest("binary"),
      ).readUInt32LE();
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
        id IN ${sql(result.map((e) => e.anilist))}
    `;
    result = result.map((entry) => {
      entry.anilist = anilist.find((e) => e.id === entry.anilist)?.json ?? entry.anilist;
      return entry;
    });
  }

  await logAndDequeue(
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
