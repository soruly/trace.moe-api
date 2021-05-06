import crypto from "crypto";
import os from "os";
import path from "path";
import child_process from "child_process";
import util from "util";
import fetch from "node-fetch";
import fs from "fs-extra";
import aniep from "aniep";
import cv from "opencv4nodejs";
import Knex from "knex";
import * as redis from "redis";
import { performance } from "perf_hooks";

const client = redis.createClient();
const delAsync = util.promisify(client.del).bind(client);
const mgetAsync = util.promisify(client.mget).bind(client);
const keysAsync = util.promisify(client.keys).bind(client);
const incrAsync = util.promisify(client.incr).bind(client);
const decrAsync = util.promisify(client.decr).bind(client);
const expireAsync = util.promisify(client.expire).bind(client);

const {
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  TRACE_MEDIA_SALT,
} = process.env;

const knex = Knex({
  client: "mysql",
  connection: {
    host: SOLA_DB_HOST,
    port: SOLA_DB_PORT,
    user: SOLA_DB_USER,
    password: SOLA_DB_PWD,
    database: SOLA_DB_NAME,
  },
});

const search = (coreList, image, candidates, anilistID) =>
  Promise.all(
    coreList.map((coreURL) =>
      fetch(
        `${coreURL}/lireq?${[
          "field=cl_ha",
          "ms=false",
          `accuracy=2`,
          `candidates=${candidates}`,
          "rows=30",
          anilistID ? `fq=id:${anilistID}/*` : "",
        ].join("&")}`,
        {
          method: "POST",
          body: image,
        }
      )
    )
  );

const logAndDequeue = async (uid, priority, status, searchTime) => {
  if (searchTime) {
    await knex("log").insert({ time: knex.fn.now(), uid, status, search_time: searchTime });
  } else {
    await knex("log").insert({ time: knex.fn.now(), uid, status });
  }
  const c = await decrAsync(`c:${uid}`);
  if (c < 0) {
    await delAsync(`c:${uid}`);
  }
  const q = await decrAsync(`q:${priority}`);
  if (q < 0) {
    await delAsync(`q:${priority}`);
  }
};

export default async (req, res) => {
  const rows = await knex("tier").select("concurrency", "quota", "priority").where("id", 0);
  let quota = rows[0].quota;
  let concurrency = rows[0].concurrency;
  let priority = rows[0].priority;
  let uid = req.ip;
  const apiKey = req.query.key ?? req.header("x-trace-key") ?? "";
  if (apiKey) {
    const rows = await knex("user_view")
      .select("id", "quota", "concurrency", "priority")
      .where("api_key", apiKey);
    quota = rows[0].quota;
    concurrency = rows[0].concurrency;
    priority = rows[0].priority;
    uid = rows[0].id >= 1000 ? rows[0].id : req.query.uid ?? rows[0].id;
  }
  const searchCount = (
    await knex("log")
      .count({ count: "time" })
      .where("time", ">", new Date().toISOString().replace(/(\d+-\d+).+/, "$1-01T00:00:00.000Z"))
      .andWhere({ status: 200, uid })
  )[0].count;

  if (searchCount >= quota) {
    await knex("log").insert({ time: knex.fn.now(), uid, status: 402 });
    return res.status(402).json({
      error: "Search quota depleted",
    });
  }

  const concurrentCount = await incrAsync(`c:${uid}`);
  await expireAsync(`c:${uid}`, 60);
  if (concurrentCount > concurrency) {
    await logAndDequeue(uid, priority, 402);
    return res.status(402).json({
      error: "Concurrency limit exceeded",
    });
  }

  await incrAsync(`q:${priority}`);
  await expireAsync(`q:${priority}`, 60);
  const queueKeys = await keysAsync("q:*");
  const priorityKeys = queueKeys.filter((e) => Number(e.split(":")[1]) >= priority);
  const priorityQueues = priorityKeys.length ? await mgetAsync(priorityKeys) : [];
  const priorityQueuesLength = priorityQueues.map((e) => Number(e)).reduce((a, b) => a + b, 0);

  if (priorityQueuesLength >= 5) {
    await logAndDequeue(uid, priority, 503);
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
      await logAndDequeue(uid, priority, 400);
      return res.status(400).json({
        error: `Invalid image url ${req.query.url}`,
      });
    }

    const response = await fetch(
      [
        "api.telegram.org",
        "cdn.discordapp.com",
        "media.discordapp.net",
        "media.trace.moe",
      ].includes(new URL(req.query.url).hostname)
        ? req.query.url
        : `https://trace.moe/image-proxy?url=${encodeURIComponent(req.query.url)}`
    );
    if (response.status >= 400) {
      await logAndDequeue(uid, priority, 400);
      return res.status(response.status).json({
        error: `Failed to fetch image ${req.query.url}`,
      });
    }
    searchFile = await response.buffer();
  } else if (req.file) {
    searchFile = req.file.buffer;
  } else {
    await logAndDequeue(uid, priority, 405);
    return res.status(405).json({
      error: "Method Not Allowed",
    });
  }

  const tempFilePath = path.join(os.tmpdir(), `queryFile${process.hrtime().join("")}`);
  const tempImagePath = path.join(os.tmpdir(), `queryImage${process.hrtime().join("")}.jpg`);
  fs.writeFileSync(tempFilePath, searchFile);
  child_process.spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "warning",
      "-nostats",
      "-y",
      "-ss",
      "00:00:00",
      "-i",
      tempFilePath,
      "-vframes",
      "1",
      "-vf",
      "scale=320:-2",
      tempImagePath,
    ],
    { encoding: "utf-8" }
  );
  if (!fs.existsSync(tempImagePath)) {
    await logAndDequeue(uid, priority, 400);
    return res.status(400).json({
      error: `Failed to process image`,
    });
  }
  let searchImage = fs.readFileSync(tempImagePath);
  fs.removeSync(tempFilePath);
  fs.removeSync(tempImagePath);

  if (req.query.cutBorders) {
    // auto black border cropping
    try {
      const image = cv.imdecode(searchImage);
      const [height, width] = image.sizes;
      // Find the possible rectangles
      const contours = image
        .bgrToGray()
        .threshold(4, 255, cv.THRESH_BINARY) // low enough so dark background is not cut away
        .findContours(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      let { x, y, width: w, height: h } = contours.length
        ? contours
            .sort((c0, c1) => c1.area - c0.area)[0] // Find the largest rectangle
            .boundingRect()
        : { x: 0, y: 0, width, height };

      if (x !== 0 || y !== 0 || w !== width || h !== height) {
        if (w > 0 && h > 0 && w / h < 16 / 9 && w / h >= 1.6) {
          // if detected area is slightly larger than 16:9 (e.g. 16:10)
          const newHeight = Math.round((w / 16) * 9); // assume it is 16:9
          y = Math.round(y - (newHeight - h) / 2);
          h = newHeight;
          // cut 1px more for anti-aliasing
          h = h - 1;
          y = y + 1;
        }
        // ensure the image has correct dimensions
        y = y <= 0 ? 0 : y;
        x = x <= 0 ? 0 : x;
        w = w <= 1 ? 1 : w;
        h = h <= 1 ? 1 : h;
        w = w >= width ? width : w;
        h = h >= height ? height : h;

        searchImage = cv.imencode(".jpg", image.getRegion(new cv.Rect(x, y, w, h)));
        // fs.outputFileSync(`temp/${new Date().toISOString()}.jpg`, searchImage);
      }
    } catch (e) {
      // fs.outputFileSync(`temp/${new Date().toISOString()}.jpg`, searchImage);
      await logAndDequeue(uid, priority, 400);
      return res.status(400).json({
        error: "OpenCV: Failed to detect and cut borders",
      });
    }
  }
  // fs.outputFileSync(`temp/${new Date().toISOString()}.jpg`, searchImage);

  if (!req.app.locals.coreList || req.app.locals.coreList.length === 0) {
    await logAndDequeue(uid, priority, 500);
    return res.status(500).json({
      error: "Database is offline",
    });
  }

  let candidates = 1000000;
  const startTime = performance.now();
  let solrResponse = null;
  try {
    solrResponse = await search(
      req.app.locals.coreList,
      searchImage,
      candidates,
      Number(req.query.anilistID)
    );
  } catch (e) {
    await logAndDequeue(uid, priority, 503);
    return res.status(503).json({
      error: `Error: Database is not responding`,
    });
  }
  if (solrResponse.find((e) => e.status >= 500)) {
    const r = solrResponse.find((e) => e.status >= 500);
    await logAndDequeue(uid, priority, r.status);
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
    solrResponse = await search(
      req.app.locals.coreList,
      searchImage,
      candidates,
      Number(req.query.anilistID)
    );
    if (solrResponse.find((e) => e.status >= 500)) {
      const r = solrResponse.find((e) => e.status >= 500);
      await logAndDequeue(uid, priority, r.status);
      return res.status(r.status).json({
        error: `Database is ${r.status === 504 ? "overloaded" : "offline"}`,
      });
    }
    solrResults = await Promise.all(solrResponse.map((e) => e.json()));
  }
  const searchTime = (performance.now() - startTime) | 0;

  let result = [];
  let frameCountList = [];
  let rawDocsSearchTimeList = [];
  let reRankSearchTimeList = [];

  if (solrResults.Error) {
    await logAndDequeue(uid, priority, 500);
    return res.status(500).json({
      error: solrResults.Error,
    });
  }

  for (const { RawDocsCount, RawDocsSearchTime, ReRankSearchTime, response } of solrResults) {
    frameCountList.push(Number(RawDocsCount));
    rawDocsSearchTimeList.push(Number(RawDocsSearchTime));
    reRankSearchTimeList.push(Number(ReRankSearchTime));
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
          (Math.abs(e.from - t) < 5 || Math.abs(e.to - t) < 5)
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

  const anilistDB = await knex("anilist_view")
    .select("id", "json")
    .havingIn(
      "id",
      result.map((result) => result.anilist_id)
    );

  result = result.map(({ anilist_id, filename, t, from, to, d }) => {
    const mid = from + (to - from) / 2;
    const token = crypto
      .createHash("sha1")
      .update([anilist_id, filename, mid, TRACE_MEDIA_SALT].join(""))
      .digest("base64")
      .replace(/[^0-9A-Za-z]/g, "");

    let anilistInfo = anilist_id;
    if (!anilistDB.find((e) => e.id === anilist_id)) {
      console.log(`${anilist_id}/${filename} should be deleted from DB`);
    } else {
      const src = JSON.parse(anilistDB.find((e) => e.id === anilist_id).json);
      if (req.query.info === "full") {
        anilistInfo = src;
      } else if (req.query.info === "advanced") {
        anilistInfo = {
          // averageScore: src.averageScore,
          bannerImage: src.bannerImage,
          // characters: src.characters,
          coverImage: src.coverImage,
          // description: src.description,
          duration: src.duration,
          endDate: src.endDate,
          episodes: src.episodes,
          externalLinks: src.externalLinks,
          format: src.format,
          genres: src.genres,
          // hashtag: src.hashtag,
          id: src.id,
          idMal: src.idMal,
          isAdult: src.isAdult,
          // meanScore: src.meanScore,
          // popularity: src.popularity,
          // rankings: src.rankings,
          // relations: src.relations,
          season: src.season,
          siteUrl: src.siteUrl,
          source: src.source,
          // staff: src.staff,
          startDate: src.startDate,
          // stats: src.stats,
          status: src.status,
          studios: src.studios,
          synonyms: src.synonyms,
          synonyms_chinese: src.synonyms_chinese,
          // tags: src.tags,
          title: src.title,
          // trailer: src.trailer,
          type: src.type,
          // updatedAt: src.updatedAt,
        };
      } else if (req.query.info === "basic") {
        anilistInfo = {
          id: src.id,
          idMal: src.idMal,
          isAdult: src.isAdult,
          synonyms: src.synonyms,
          synonyms_chinese: src.synonyms_chinese,
          title: src.title,
        };
      } else if (req.query.info === "id") {
        anilistInfo = {
          id: src.id,
          idMal: src.idMal,
        };
      }
    }

    return {
      anilist: anilistInfo,
      filename,
      episode: aniep(filename),
      from,
      to,
      similarity: (100 - d) / 100,
      video: `https://media.trace.moe/video/${anilist_id}/${encodeURIComponent(filename)}?${[
        `t=${mid}`,
        `token=${token}`,
      ].join("&")}`,
      image: `https://media.trace.moe/image/${anilist_id}/${encodeURIComponent(filename)}?${[
        `t=${mid}`,
        `token=${token}`,
      ].join("&")}`,
    };
  });

  await logAndDequeue(uid, priority, 200, searchTime);
  res.json({
    frameCount: frameCountList.reduce((prev, curr) => prev + curr, 0),
    error: "",
    result,
  });

  // console.log(`searchTime: ${searchTime}`);
};
