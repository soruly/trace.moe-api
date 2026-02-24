import sql from "../sql.ts";

export default async (req, res) => {
  const { id } = req.query;
  if (id) {
    if (!id.match(/\d+/)) {
      return res.status(400).json({
        error: "Invalid param id: must be a number",
      });
    }
    return res.json(
      await sql`
        SELECT
          path,
          status,
          created
        FROM
          files
        WHERE
          path LIKE ${id + "/%"}
      `,
    );
  }

  const [row] = await sql`
    SELECT
      updated
    FROM
      files
    ORDER BY
      updated DESC
    LIMIT
      1;
  `;

  const collectionStatistics = await req.app.locals.milvus.getCollectionStatistics({
    collection_name: "frame_color_layout",
  });

  const metric = await req.app.locals.milvus.getMetric({
    request: {
      metric_type: "system_info",
    },
  });

  return res.json({
    updated: row.updated,
    row_count: Number(collectionStatistics.data.row_count),
    memory: metric.response.nodes_info[0].infos.hardware_infos.memory,
    memory_usage: metric.response.nodes_info[0].infos.hardware_infos.memory_usage,
  });
};
