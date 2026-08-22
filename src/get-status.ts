import fs from "node:fs/promises";
import sql from "../sql.ts";

let lastUpdate = new Date();
let mediaCount = 0;
let mediaFramesTotal = 0;
let mediaDurationTotal = 0;

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
          path
        FROM
          files
        WHERE
          path LIKE ${id + "/%"}
        ORDER BY
          path;
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

  if (row && row.updated != lastUpdate) {
    const [{ count, sum_frames, sum_duration }] = await sql`
      SELECT
        COUNT(*) AS count,
        SUM(frame_count) AS sum_frames,
        SUM(duration) AS sum_duration
      FROM
        files
    `;
    mediaCount = Number(count);
    mediaDurationTotal = Number(sum_duration);
    mediaFramesTotal = Number(sum_frames);
    lastUpdate = row.updated;
  }

  let rowCount = 0;
  let memory = 0;
  let memoryUsage = 0;

  try {
    const collectionStatistics = await req.app.locals.milvus.getCollectionStatistics({
      collection_name: "frame_color_layout",
    });
    if (collectionStatistics?.data?.row_count) {
      rowCount = Number(collectionStatistics.data.row_count);
    }
  } catch (err) {
    console.error("[get-status] Failed to get Milvus collection statistics:", err);
  }

  try {
    const metric = await req.app.locals.milvus.getMetric({
      request: {
        metric_type: "system_info",
      },
    });
    if (metric?.response?.nodes_info?.[0]?.infos?.hardware_infos) {
      memory = metric.response.nodes_info[0].infos.hardware_infos.memory ?? 0;
      memoryUsage = metric.response.nodes_info[0].infos.hardware_infos.memory_usage ?? 0;
    }
  } catch (err) {
    console.error("[get-status] Failed to get Milvus metrics:", err);
  }

  const stats = await fs.statfs(process.env.VIDEO_PATH);

  return res.json({
    updated: row.updated,
    rowCount,
    memory,
    memoryUsage,
    storage: Number(stats.blocks * stats.bsize),
    storageFree: Number(stats.bfree * stats.bsize),
    storageAvailable: Number(stats.bavail * stats.bsize),
    mediaCount,
    mediaFramesTotal,
    mediaDurationTotal,
  });
};
