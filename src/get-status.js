import fetch from "node-fetch";

const { SOLA_SOLR_LIST } = process.env;

export default async (req, res) => {
  try{  const statusList = (
    await Promise.all(
      SOLA_SOLR_LIST.split(",").map((solrUrl) =>
        fetch(`${solrUrl}admin/cores?wt=json`)
          .then((res) => res.json())
          .then(({ status }) => ({ solrUrl, cores: Object.values(status) }))
      )
    )
  ).reduce((acc, cur) => {
    acc[cur.solrUrl] = cur.cores;
    return acc;
  }, {});
  return res.json(statusList);
  }catch(e){
    console.log(e);
    return res.status(503);
  }
};
