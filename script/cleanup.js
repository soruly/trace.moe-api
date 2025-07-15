import path from "node:path";
import fs from "node:fs/promises";
import sql from "../sql.js";
import getSolrCoreList from "../src/lib/get-solr-core-list.js";

const { HASH_PATH, VIDEO_PATH, SOLA_SOLR_LIST } = process.env;

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
              "\\$1",
            )}\\/*</query></delete>`,
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
const rows = await sql`SELECT path, status FROM file`;

for (const { status, path } of rows) {
  if (["HASHED", "LOADING", "LOADED"].includes(status)) {
    try {
      await fs.access(path.join(HASH_PATH, `${path}.xml.xz`));
    } catch {
      console.log(`Hash not found: ${path}`);
    }
  }
  const mp4FilePath = path.join(VIDEO_PATH, path);
  const hashFilePath = path.join(HASH_PATH, `${path}.xml.xz`);
  try {
    await fs.access(mp4FilePath);
  } catch {
    console.log(`Found ${mp4FilePath} deleted`);
    await unload(path, coreList);
    try {
      await fs.access(hashFilePath);
      console.log(`Deleting ${hashFilePath}`);
      await fs.rm(hashFilePath);
    } catch {}
    await sql`DELETE FROM file WHERE path=${path}`;
  }
}

await sql.end();

console.log("Completed");
