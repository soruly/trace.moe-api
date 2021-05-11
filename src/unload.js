import Knex from "knex";
import fetch from "node-fetch";

const { SOLA_DB_HOST, SOLA_DB_PORT, SOLA_DB_USER, SOLA_DB_PWD, SOLA_DB_NAME, TRACE_ALGO } =
  process.env;

const knex = Knex({
  client: "mysql",
  connection: {
    host: SOLA_DB_HOST,
    port: SOLA_DB_PORT,
    user: SOLA_DB_USER,
    password: SOLA_DB_PWD,
    database: SOLA_DB_NAME,
  },
});

export default async (req, res) => {
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
