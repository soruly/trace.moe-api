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
const getAsync = util.promisify(client.get).bind(client);
const ttlAsync = util.promisify(client.ttl).bind(client);

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
          `accuracy=3`,
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

export default async (req, res) => {
  const apiKey = req.query.key ?? req.header("x-trace-key") ?? "";
  if (apiKey) {
    const rows = await knex("user")
      .select("id", "monthly_quota", "monthly_search")
      .where("api_key", apiKey);
    if (rows[0].monthly_search >= rows[0].monthly_quota) {
      return res.status(402).json({
        frameCount: 0,
        error: "You have reached your monthly search quota",
        result: [],
      });
    }
  }

  let searchImage;
  if (req.query.url) {
    // console.log(req.query.url);
    try {
      new URL(req.query.url);
    } catch (e) {
      return res.status(400).json({
        frameCount: 0,
        error: `Invalid image url ${req.query.url}`,
        result: [],
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
      return res.status(response.status).json({
        frameCount: 0,
        error: `Failed to fetch image ${req.query.url}`,
        result: [],
      });
    }
    if (
      response.headers.get("Content-Type")?.startsWith("video/") ||
      [".mp4", ".webm", ".mkv"].includes(path.extname(new URL(req.query.url).pathname))
    ) {
      const tempVideoPath = path.join(os.tmpdir(), `queryVideo${process.hrtime().join("")}.mp4`);
      const tempImagePath = path.join(os.tmpdir(), `queryImage${process.hrtime().join("")}.jpg`);
      await fs.writeFile(tempVideoPath, await response.buffer());
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
          tempVideoPath,
          "-vframes",
          "1",
          "-vf",
          "scale=320:-2",
          "-crf",
          "23",
          "-preset",
          "faster",
          tempImagePath,
        ],
        { encoding: "utf-8" }
      );
      if (!fs.existsSync(tempImagePath)) {
        return res.status(500).json({
          frameCount: 0,
          error: `Failed to extract image from ${req.query.url}`,
          result: [],
        });
      }
      searchImage = fs.readFileSync(tempImagePath);
      fs.removeSync(tempVideoPath);
      fs.removeSync(tempImagePath);
    } else {
      searchImage = await response.buffer();
    }
  } else if (req.file) {
    searchImage = req.file.buffer;
  }

  if (req.query.cutBorders) {
    // auto black border cropping
    let image;
    try {
      image = cv.imdecode(searchImage);
    } catch (e) {
      return res.json({
        frameCount: 0,
        error: "OpenCV: Failed to decode image",
        result: [],
      });
    }
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

    if (x === 0 && y === 0 && w === width && h === height) {
      const croppedImage = image.resize(Math.round((height / width) * 320), 320);
      // cv.imwrite(`temp/${performance.now()}.png`, croppedImage);
      searchImage = cv.imencode(".jpg", croppedImage);
    } else {
      if (w > 0 && h > 0 && Math.abs(w / h - 16 / 9) < 0.2) {
        // if detected area is near 16:9 (e.g. 16:10), assume it is 16:9
        const newHeight = Math.round((w / 16) * 9) - 2; // cut 2px more for anti-aliasing after scale
        y = Math.round(y - (newHeight - h) / 2);
        h = newHeight;
      }
      // ensure the image has dimension
      y = y <= 0 ? 0 : y;
      x = x <= 0 ? 0 : x;
      w = w <= 1 ? 1 : w;
      h = h <= 1 ? 1 : h;

      const croppedImage = image
        .getRegion(new cv.Rect(x, y, w, h))
        .resize(Math.round((height / width) * 320), 320);
      // cv.imwrite(`temp/${performance.now()}.png`, croppedImage);
      searchImage = cv.imencode(".jpg", croppedImage);
    }
  }

  if (!req.app.locals.coreList || req.app.locals.coreList.length === 0) {
    return res.json({
      frameCount: 0,
      error: "Database is offline",
      result: [],
    });
  }

  let candidates = 1000000;

  const startTime = performance.now();
  let solrResponse = await search(
    req.app.locals.coreList,
    searchImage,
    candidates,
    Number(req.query.anilistID)
  );
  if (solrResponse.find((e) => e.status >= 500)) {
    const r = solrResponse.find((e) => e.status >= 500);
    return res.json({
      frameCount: 0,
      error: `HTTP ${r.status} Database is ${r.status === 504 ? "overloaded" : "offline"}`,
      result: [],
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
      return res.json({
        frameCount: 0,
        error: `HTTP ${r.status} Database is ${r.status === 504 ? "overloaded" : "offline"}`,
        result: [],
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
    return res.json({
      frameCount: 0,
      error: solrResults.Error,
      result: [],
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
    if (!anilistDB.find((e) => e.id === anilist_id)) {
      console.log(`${anilist_id}/${filename} should be deleted from DB`);
    }
    const anilist = JSON.parse(anilistDB.find((e) => e.id === anilist_id).json);
    const token = crypto
      .createHash("sha1")
      .update([anilist.id, filename, mid, TRACE_MEDIA_SALT].join(""))
      .digest("base64")
      .replace(/[^0-9A-Za-z]/g, "");

    return {
      anilist:
        req.query.anilistInfo === "full"
          ? anilist
          : req.query.anilistInfo === "id"
          ? {
              id: anilist.id,
              idMal: anilist.idMal,
            }
          : {
              id: anilist.id,
              idMal: anilist.idMal,
              isAdult: anilist.isAdult,
              synonyms: anilist.synonyms,
              synonyms_chinese: anilist.synonyms_chinese,
              title: anilist.title,
            },
      filename,
      episode: aniep(filename),
      from,
      to,
      similarity: (100 - d) / 100,
      video: `https://media.trace.moe/video/${anilist.id}/${encodeURIComponent(filename)}?${[
        `t=${mid}`,
        `token=${token}`,
      ].join("&")}`,
      image: `https://media.trace.moe/image/${anilist.id}/${encodeURIComponent(filename)}?${[
        `t=${mid}`,
        `token=${token}`,
      ].join("&")}`,
    };
  });

  res.json({
    frameCount: frameCountList.reduce((prev, curr) => prev + curr, 0),
    error: "",
    result,
  });

  if (apiKey) {
    await knex("user").where("api_key", apiKey).increment("monthly_search", 1);
  }
  // console.log(`searchTime: ${searchTime}`);
};
