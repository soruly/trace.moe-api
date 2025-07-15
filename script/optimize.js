process.loadEnvFile();
import getSolrCoreList from "../src/lib/get-solr-core-list.js";

for (const coreURLs of getSolrCoreList().reduce(
  (acc, cur, index, array) => (index % 4 ? acc : [...acc, array.slice(index, index + 4)]),
  [],
)) {
  console.log(`Optimizing:\n${coreURLs.join("\n")}`);
  await Promise.all(coreURLs.map((coreURL) => fetch(`${coreURL}/update?wt=json&optimize=true`)));
}
