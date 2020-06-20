require("dotenv").config();
const fetch = require("node-fetch");
const Koa = require("koa");
const Router = require("@koa/router");
const multer = require("@koa/multer");
const cors = require("@koa/cors");
const app = new Koa();
const router = new Router();
const upload = multer();

const {
  SOLA_SOLR_URL,
  SOLA_SOLR_CORE,
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
} = process.env;

(async () => {
  router
    .get("/me", require("./src/me.js"))
    .all("/search", upload.single("image"), require("./src/search.js"))
    .get("/status", require("./src/status.js"))
    .get("/video/:anilistID/:file", require("./src/video.js"))
    .get("/thumb/:anilistID/:file", require("./src/thumb.js"))
    .get("/duration/:anilistID/:file", require("./src/duration.js"))
    .all("/", (ctx) => {
      ctx.body = "ok";
    });

  app.context.coreNameList = Object.keys(
    (await fetch(`${SOLA_SOLR_URL}admin/cores?wt=json`).then((res) => res.json())).status
  ).filter((coreName) => coreName.startsWith(`${SOLA_SOLR_CORE}_`));

  app
    .use(require("koa-logger")())
    .use(
      cors({
        origin: "*",
      })
    )
    .use(require("koa-bodyparser")())
    .use(router.routes())
    .use(router.allowedMethods())
    .listen(3001);
})();
