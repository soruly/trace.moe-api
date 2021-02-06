import fetch from "node-fetch";

const { SOLA_SOLR_LIST } = process.env;

export default async () =>
  (
    await Promise.all(
      SOLA_SOLR_LIST.split(",").map((solrUrl) =>
        fetch(`${solrUrl}admin/cores?wt=json`)
          .then((res) => res.json())
          .then(({ status }) => Object.keys(status).map((coreName) => `${solrUrl}${coreName}`))
      )
    )
  ).flat();
