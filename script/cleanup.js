import path from "node:path";
import fs from "node:fs/promises";
import sql from "../sql.js";
import getSolrCoreList from "../src/lib/get-solr-core-list.js";

const { VIDEO_PATH, SOLA_SOLR_LIST, HASH_PATH } = process.env;

const unload = (id, anilist_id, coreList) =>
  new Promise(async (resolve, reject) => {
    try {
      await Promise.all(
        coreList.map((coreURL) =>
          fetch(`${coreURL}/update?wt=json&commit=true`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // http://lucene.apache.org/core/6_5_1/queryparser/org/apache/lucene/queryparser/classic/package-summary.html#Escaping_Special_Characters
            body: JSON.stringify({
              delete: {
                query: `id:${anilist_id}\\/${id}\\/*`,
              },
            }),
          }),
        ),
      );
      resolve();
    } catch (e) {
      reject(new Error(e));
    }
  });

console.log("Loading solr core list...");
const coreList = getSolrCoreList();
console.log(
  `Loaded ${coreList.length} cores from ${SOLA_SOLR_LIST.split(",").length} solr servers`,
);

console.log("Checking invalid states");
const rows = await sql`
  SELECT
    id,
    anilist_id,
    path,
    status
  FROM
    files
`;

for (const row of rows) {
  if (["ANALYZED", "HASHED", "LOADING", "LOADED"].includes(row.status)) {
    try {
      await fs.access(path.join(HASH_PATH, `${row.path}.json.zst`));
    } catch {
      console.log(`Hash not found: ${row.path}`);
    }
  }
  const mp4FilePath = path.join(VIDEO_PATH, row.path);
  const hashFilePath = path.join(HASH_PATH, `${row.path}.json.zst`);
  try {
    await fs.access(mp4FilePath);
  } catch {
    console.log(`Found ${mp4FilePath} deleted`);
    await unload(row.id, row.anilist_id, coreList);
    try {
      await fs.access(hashFilePath);
      console.log(`Deleting ${hashFilePath}`);
      await fs.rm(hashFilePath);
    } catch {}
    await sql`
      DELETE FROM files
      WHERE
        path = ${row.path}
    `;
  }
}

await sql.end();

console.log("Completed");
