import RSS from "rss";

const { TRACE_ALGO } = process.env;

export default async (req, res) => {
  const knex = req.app.locals.knex;

  const { offset = 0, limit = 100 } = req.query;

  const rows = await knex(`${TRACE_ALGO}`)
    .where("status", "LOADED")
    .orderBy("updated", "desc")
    .offset(Number(offset) >= 0 ? Number(offset) : 0)
    .limit(Number(limit) > 0 ? (Number(limit) <= 1000 ? Number(limit) : 1000) : 100);
  const feed = new RSS({
    title: "trace.moe Hash Feeds",
    feed_url: "https://api.trace.moe/rss.xml",
    site_url: "https://trace.moe",
    image_url: "https://trace.moe/favicon128.png",
    docs: "https://soruly.github.io/trace.moe-api/",
    generator: null,
    pubDate: rows.length ? new Date(rows[0].updated).toISOString() : new Date(0),
  });

  for (const row of rows) {
    feed.item({
      title: row.path.split("/")[1],
      description: row.path,
      url: `https://api.trace.moe/hash/${row.path.split("/")[0]}/${encodeURIComponent(
        row.path.split("/")[1],
      )}`,
      date: new Date(row.updated).toISOString(),
    });
  }
  res.set("Content-Type", "text/xml");
  res.set(
    "Content-Security-Policy",
    [
      "default-src 'none'",
      "style-src 'unsafe-inline'",
      "img-src data:",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'none'",
      "block-all-mixed-content",
    ].join("; "),
  );
  return res.send(
    feed
      .xml({ indent: true })
      .replace(/<rss.*?>/, `<rss version="2.0">`)
      .replace(/<atom:link.*?>/, ""),
  );
};
