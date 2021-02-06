import path from "path";
import fetch from "node-fetch";
import getSolrCoreList from "../lib/get-solr-core-list.js";

const { SOLA_SOLR_LIST, TRACE_ALGO } = process.env;

export default async (req, res) => {
  const createCore = async (solrUrl, coreName) => {
    console.log(`Check if solr core ${coreName} already loaded in ${solrUrl}`);
    const result = await fetch(`${solrUrl}admin/cores?wt=json`).then((res) => res.json());

    if (Object.keys(result.status).includes(coreName)) {
      console.log(`Unloading existing core ${coreName}`);
      await fetch(`${solrUrl}admin/cores?action=UNLOAD&core=${coreName}&wt=json`);
    }

    const instanceDir = path.join("/opt/mysolrhome", coreName);
    console.log(`Creating solr core ${coreName}`);
    await fetch(
      `${solrUrl}admin/cores?action=CREATE&name=${coreName}&instanceDir=${instanceDir}&configSet=/opt/mysolrhome`
    )
      .then((response) => {
        console.log(response);
      })
      .catch((error) => {
        console.log(error);
      });
  };

  for (const solrUrl of SOLA_SOLR_LIST.split(",")) {
    for (let i = 0; i < (Number(req.query.count) || 4); i++) {
      await createCore(solrUrl, `${TRACE_ALGO}_${i}`);
    }
  }
  console.log("Loading solr core list...");
  req.app.locals.coreList = await getSolrCoreList();
  console.log(
    `Loaded ${req.app.locals.coreList.length} cores from ${
      SOLA_SOLR_LIST.split(",").length
    } solr servers`
  );
  res.send();
};
