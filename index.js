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
  SOLA_SOLR_LIST,
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
    .all("/", (ctx) => {
      ctx.body = "ok";
    });

  console.log("Loading solr core list...");
  const coreList = (
    await Promise.all(
      SOLA_SOLR_LIST.split(",").map((solrUrl) =>
        fetch(`${solrUrl}admin/cores?wt=json`)
          .then((res) => res.json())
          .then(({ status }) => Object.keys(status).map((coreName) => `${solrUrl}${coreName}`))
      )
    )
  ).flat();

  app.context.coreList = coreList;

  console.log(
    `Loaded ${coreList.length} cores from ${SOLA_SOLR_LIST.split(",").length} solr servers`
  );

  app
    .use(require("koa-logger")())
    .use(require("koa-bodyparser")())
    .use(router.routes())
    .listen(3001);
})();
