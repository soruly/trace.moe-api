import fetch from "node-fetch";

const { TRACE_ALGO } = process.env;

export default async (req, res) => {
  const knex = req.app.locals.knex;

  const { anilistID, filename } = req.params;
  console.log(`Unloading ${anilistID}/${filename}`);
  await Promise.all(
    req.app.locals.coreList.map((coreURL) =>
      fetch(`${coreURL}/update?wt=json&commit=true`, {
        method: "POST",
        headers: { "Content-Type": "text/xml" },
        // http://lucene.apache.org/core/6_5_1/queryparser/org/apache/lucene/queryparser/classic/package-summary.html#Escaping_Special_Characters
        body: `<delete><query>id:${anilistID}/${filename.replace(
          /([ +\-!(){}[\]^"~*?:\\/])/g,
          "\\$1"
        )}\\/*</query></delete>`,
      })
    )
  );
  // await knex(TRACE_ALGO).where("path", `${anilistID}/${filename}`).update({ status: "HASHED" });
  res.sendStatus(204);
};
