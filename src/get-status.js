import sql from "../sql.js";

const { SOLA_SOLR_LIST } = process.env;

export default async (req, res) => {
  const { id } = req.query;
  if (id) {
    if (!id.match(/\d+/)) {
      return res.status(400).json({
        error: "Invalid param id: must be a number",
      });
    }
    return res.json(
      await sql`SELECT path, status, created FROM files WHERE path LIKE  ${id + "/%"}`,
    );
  }

  try {
    const statusList = (
      await Promise.all(
        SOLA_SOLR_LIST.split(",").map((solrUrl) =>
          fetch(`${solrUrl}admin/cores?wt=json`)
            .then((res) => res.json())
            .then(({ status }) => ({ solrUrl, cores: Object.values(status) }))
            .catch((e) => res.status(503)),
        ),
      )
    ).reduce((acc, cur) => {
      acc[cur.solrUrl] = cur.cores;
      return acc;
    }, {});
    return res.json(statusList);
  } catch (e) {
    console.log(e);
    return res.status(503);
  }
};
