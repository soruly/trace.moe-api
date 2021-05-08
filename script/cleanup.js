import "dotenv/config";
import path from "path";
import fs from "fs-extra";
import Knex from "knex";
import fetch from "node-fetch";
import getSolrCoreList from "../lib/get-solr-core-list.js";

const {
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  TRACE_ALGO,
  HASH_PATH,
  SOLA_SOLR_LIST,
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

const unload = (relativePath, coreList) =>
  new Promise(async (resolve, reject) => {
    try {
      await Promise.all(
        coreList.map((coreURL) =>
          fetch(`${coreURL}/update?wt=json&commit=true`, {
            method: "POST",
            headers: { "Content-Type": "text/xml" },
            // http://lucene.apache.org/core/6_5_1/queryparser/org/apache/lucene/queryparser/classic/package-summary.html#Escaping_Special_Characters
            body: `<delete><query>id:${relativePath.replace(
              /([ +\-!(){}[\]^"~*?:\\/])/g,
              "\\$1"
            )}\\/*</query></delete>`,
          })
        )
      );
      resolve();
    } catch (e) {
      reject(new Error(e));
    }
  });

console.log("Loading solr core list...");
let coreList = [];
if (fs.existsSync("core-list.json")) {
  coreList = JSON.parse(fs.readFileSync("core-list.json", "utf8"));
} else {
  const coreList = await getSolrCoreList();
  fs.outputFileSync("core-list.json", JSON.stringify(coreList, null, 2));
}
console.log(
  `Loaded ${coreList.length} cores from ${SOLA_SOLR_LIST.split(",").length} solr servers`
);

console.log("Checking invalid states");
const rows = await knex(TRACE_ALGO).select("path", "status");

for (const row of rows) {
  if (["HASHED", "LOADING", "LOADED"].includes(row.status)) {
    if (!fs.existsSync(path.join(HASH_PATH, `${row.path}.xml.xz`))) {
      console.log(`Hash not found: ${row.path}`);
    }
  }
  const mp4FilePath = path.join("/mnt/nfs/shuvi/anilist", row.path);
  const hashFilePath = path.join(HASH_PATH, `${row.path}.xml.xz`);
  if (!fs.existsSync(mp4FilePath)) {
    console.log(`Found ${mp4FilePath} deleted`);
    await unload(row.path, coreList);
    if (fs.existsSync(hashFilePath)) {
      console.log(`Deleting ${hashFilePath}`);
      fs.removeSync(hashFilePath);
    }
    await knex(TRACE_ALGO).where("path", row.path).del();
  }
}

await knex.destroy();

console.log("Completed");
