import fetch from "node-fetch";

const { SOLA_SOLR_LIST } = process.env;

export default async (req, res) => {
  const statusList = (
    await Promise.all(
      SOLA_SOLR_LIST.split(",").map((solrUrl) =>
        fetch(`${solrUrl}admin/cores?wt=json`)
          .then((res) => res.json())
          .then(({ status }) => [solrUrl, status])
      )
    )
  ).reduce((acc, cur) => {
    acc[cur[0]] = cur[1];
    return acc;
  }, {});

  let lastModified = 0;
  let sizeInBytes = 0;
  let numDocs = 0;
  // console.log(Object.entries(statusList));
  for (const [solrUrl, coreList] of Object.entries(statusList)) {
    for (const core of Object.values(coreList)) {
      if (new Date(core.index.lastModified) > lastModified) {
        lastModified = new Date(core.index.lastModified);
      }
      sizeInBytes += core.index.sizeInBytes;
      numDocs += core.index.numDocs;
    }
  }

  res.json({
    lastModified,
    sizeInBytes,
    numDocs,
  });
};
