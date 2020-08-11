require("dotenv").config();
const crypto = require("crypto");
const fetch = require("node-fetch");
const aniep = require("aniep");
const cv = require("opencv4nodejs");
const redis = require("redis");
const client = redis.createClient();
const util = require("util");
const getAsync = util.promisify(client.get).bind(client);
const ttlAsync = util.promisify(client.ttl).bind(client);

const {
  SOLA_SOLR_URL,
  SOLA_SOLR_CORE,
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  ANIME_DB_HOST,
  ANIME_DB_PORT,
  ANIME_DB_USER,
  ANIME_DB_PWD,
  ANIME_DB_NAME,
} = process.env;

const knex = require("knex")({
  client: "mysql",
  connection: {
    host: ANIME_DB_HOST,
    port: ANIME_DB_PORT,
    user: ANIME_DB_USER,
    password: ANIME_DB_PWD,
    database: ANIME_DB_NAME,
  },
});

module.exports = async (ctx) => {
  let searchImage = ctx.request.query.url
    ? await fetch(
        `https://trace-moe-image-proxy.now.sh/api/image-proxy?url=${ctx.request.query.url}`
      ).then((res) => res.buffer())
    : ctx.file.buffer;
  if (true) {
    // crop image or not
    const image = cv.imdecode(searchImage);
    const [height, width] = image.sizes;
    // Find the largest rectangle
    let { x, y, width: w, height: h } = image
      .bgrToGray()
      .threshold(8, 255, cv.THRESH_BINARY)
      .findContours(cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
      .sort((c0, c1) => c1.area - c0.area)[0]
      .boundingRect();

    // For images that is not near 16:9, ensure bounding rect is at least 16:9 or taller
    // And its detected bounding rect wider than 16:9
    if (Math.abs(width / height - 16 / 9) < 0.03 && w / h - 16 / 9 > 0.03) {
      // increase top and bottom margin
      const newHeight = (w / 16) * 9;
      y = y - (newHeight - h) / 2;
      h = newHeight;
    }
    // ensure the image has dimension
    y = y < 0 ? 0 : y;
    x = x < 0 ? 0 : x;
    w = w < 1 ? 1 : w;
    h = h < 1 ? 1 : h;

    const croppedImage = image.getRegion(new cv.Rect(x, y, w, h));
    // cv.imwrite("./test.png", croppedImage);
    searchImage = cv.imencode(".jpg", croppedImage);
  }

  const solrResult = (
    await Promise.all(
      ctx.coreNameList.map((coreName) =>
        fetch(
          `${SOLA_SOLR_URL}${coreName}/lireq?${[
            "field=cl_ha",
            "ms=false",
            `accuracy=${Number(ctx.query.trial || 0)}`,
            "candidates=1000000",
            "rows=10",
          ].join("&")}`,
          {
            method: "POST",
            body: searchImage,
          }
        ).then((res) => res.json())
      )
    )
  ).reduce(
    (list, { RawDocsCount, RawDocsSearchTime, ReRankSearchTime, response }) => ({
      RawDocsCount: list.RawDocsCount + Number(RawDocsCount),
      RawDocsSearchTime: list.RawDocsSearchTime + Number(RawDocsSearchTime),
      ReRankSearchTime: list.ReRankSearchTime + Number(ReRankSearchTime),
      docs: list.docs.concat(response.docs),
    }),
    { RawDocsCount: 0, RawDocsSearchTime: 0, ReRankSearchTime: 0, docs: [] }
  );

  solrResult.docs = solrResult.docs
    .reduce((list, { d, id }) => {
      // merge nearby results within 2 seconds in the same file
      const anilist_id = Number(id.split("/")[0]);
      const file = id.split("/")[1];
      const t = Number(id.split("/")[2]);
      const index = list.findIndex(
        (e) =>
          e.anilist_id === anilist_id &&
          e.file === file &&
          (Math.abs(e.from - t) < 2 || Math.abs(e.to - t) < 2)
      );
      if (index < 0) {
        return list.concat({
          anilist_id,
          file,
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
    .sort((a, b) => a.d - b.d)
    .slice(0, 10)
    .map(({ anilist_id, file, t, from, to, d }) => {
      const start = from - 8 < 0 ? 0 : from - 8;
      const end = to + 2;
      const secretSalt = " secretsalt_iY.8eE";
      return {
        anilist_id,
        file,
        episode: aniep(file),
        t,
        from,
        to,
        start,
        end,
        diff: d,
        video: `https://trace.moe/${anilist_id}/${file}?start=${start}&end=${end}&token=${crypto
          .createHash("md5")
          .update(`/${anilist_id}/${file}${start}${end}${secretSalt}`)
          .digest("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, "")}`,
        thumb: `https://api.trace.moe/thumb/${anilist_id}/${file}?t=${t}&token=${crypto
          .createHash("md5")
          .update(`${t}${secretSalt}`)
          .digest("base64")
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=/g, "")}`,
      };
    });

  const anilistDB = await knex("anilist_view")
    .select("id", "json")
    .havingIn(
      "id",
      solrResult.docs.map((result) => result.anilist_id)
    );

  ctx.body = {
    limit: 1,
    limit_ttl: 1,
    quota: 1,
    quota_ttl: 1,
    RawDocsCount: solrResult.RawDocsCount,
    RawDocsSearchTime: solrResult.RawDocsSearchTime,
    ReRankSearchTime: solrResult.ReRankSearchTime,
    docs: solrResult.docs.map((result) => {
      const anilist = JSON.parse(anilistDB.find((e) => e.id === result.anilist_id).json);
      return {
        anilist_id: result.anilist_id,
        file: result.file,
        episode: result.episode,
        t: result.t,
        from: result.from,
        to: result.to,
        start: result.start,
        end: result.end,
        diff: result.diff,
        video: result.video,
        thumb: result.thumb,
        title_romaji: anilist.title.romaji,
        title_native: anilist.title.native,
        title_english: anilist.title.english,
        title_chinese: anilist.title.chinese,
        is_adult: anilist.isAdult,
      };
    }),
  };
};
