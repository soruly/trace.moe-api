require("dotenv").config();
const fetch = require("node-fetch");
const { SOLA_SOLR_URL } = process.env;

module.exports = async (ctx) => {
  const result = await fetch(
    `${SOLA_SOLR_URL}admin/cores?wt=json`
  ).then((res) => res.json());

  let lastModified = 0;
  let sizeInBytes = 0;
  let numDocs = 0;
  for (const [name, core] of Object.entries(result.status)) {
    if (new Date(core.index.lastModified) > lastModified) {
      lastModified = new Date(core.index.lastModified);
    }
    sizeInBytes += core.index.sizeInBytes;
    numDocs += core.index.numDocs;
  }

  ctx.body = {
    lastModified,
    sizeInBytes,
    numDocs,
  };
};
