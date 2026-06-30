import sql from "../sql.ts";

export default async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: "Missing search query parameter 'q'" });

  const query = String(q).trim();
  if (!query) return res.status(400).json({ error: "Search query cannot be empty" });

  try {
    const results = await sql`
      SELECT
        a.id,
        sub.title,
        sub.similarity::float AS similarity,
        a.json AS anilist
      FROM
        (
          SELECT DISTINCT
            ON (id) id,
            title,
            similarity (title, ${query}) AS similarity
          FROM
            anilist_title
          WHERE
            title % ${query}
            OR title ILIKE ${`%${query}%`}
          ORDER BY
            id,
            similarity (title, ${query}) DESC
        ) sub
        JOIN anilist a ON a.id = sub.id
      ORDER BY
        similarity DESC
      LIMIT
        50;
    `;

    res.json(results);
  } catch (error) {
    console.error("[anilist-search][error]", error);
    res.status(500).json({
      error: "Internal database error during search",
    });
  }
};
