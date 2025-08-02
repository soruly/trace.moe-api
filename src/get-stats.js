import sql from "../sql.js";

let lastUpdate = new Date();
let mediaCount = 0;
let mediaDurationTotal = 0;

export default async (req, res) => {
  const { type, period } = req.query;
  if (type === "media") {
    const [row] = await sql`
      SELECT
        updated
      FROM
        files
      ORDER BY
        updated DESC
      LIMIT
        1
    `;

    if (row && row.updated != lastUpdate) {
      const [count, duration] = await Promise.all([
        sql`
          SELECT
            COUNT(*) AS count
          FROM
            files
        `,
        sql`
          SELECT
            SUM(duration) AS sum
          FROM
            files
        `,
      ]);
      mediaCount = Number(count[0].count);
      mediaDurationTotal = Number(duration[0].sum);
      lastUpdate = row.updated;
    }

    return res.json({
      mediaCount,
      mediaDurationTotal,
      lastUpdate,
    });
  }

  if (!["minute", "hour", "day"].includes(period)) {
    return res.status(400).json({ error: "Invalid period" });
  }

  if (type === "traffic") {
    const rows = await sql`
      SELECT
        date_trunc(${period}, created) AS date_time,
        code,
        COUNT(*)
      FROM
        logs
      WHERE
        created > now() - ${{ minute: "60 minutes", hour: "72 hours", day: "60 days" }[
        period
      ]}::interval
      GROUP BY
        date_time,
        code
      ORDER BY
        date_time,
        code
    `;
    return res.json(
      rows.reduce((acc, { date_time, code, count }) => {
        if (!acc.find((e) => e.time === date_time.toISOString())) {
          acc.push({
            time: date_time.toISOString(),
            200: 0,
            400: 0,
            402: 0,
            405: 0,
            500: 0,
            503: 0,
            total: 0,
          });
        }
        const index = acc.findIndex((e) => e.time === date_time.toISOString());
        acc[index][code] = Number(count);
        acc[index].total += Number(count);
        return acc;
      }, []),
    );
  } else if (type === "speed") {
    return res.json(
      await sql`
        SELECT
          date_trunc(${period}, created) as time,
          percentile_disc(0) WITHIN GROUP (
            ORDER BY
              search_time
          ) as p0,
          percentile_disc(0.1) WITHIN GROUP (
            ORDER BY
              search_time
          ) as p10,
          percentile_disc(0.25) WITHIN GROUP (
            ORDER BY
              search_time
          ) as p25,
          percentile_disc(0.50) WITHIN GROUP (
            ORDER BY
              search_time
          ) as p50,
          percentile_disc(0.75) WITHIN GROUP (
            ORDER BY
              search_time
          ) as p75,
          percentile_disc(0.90) WITHIN GROUP (
            ORDER BY
              search_time
          ) as p90,
          percentile_disc(1) WITHIN GROUP (
            ORDER BY
              search_time
          ) as p100
        FROM
          logs
        WHERE
          created > now() - ${{ minute: "60 minutes", hour: "72 hours", day: "60 days" }[
          period
        ]}::interval
        GROUP BY
          time
        ORDER BY
          time
      `,
    );
  } else if (type === "accuracy") {
    return res.json(
      await sql`
        SELECT
          date_trunc(${period}, created) as time,
          percentile_disc(0) WITHIN GROUP (
            ORDER BY
              accuracy
          ) as p0,
          percentile_disc(0.1) WITHIN GROUP (
            ORDER BY
              accuracy
          ) as p10,
          percentile_disc(0.25) WITHIN GROUP (
            ORDER BY
              accuracy
          ) as p25,
          percentile_disc(0.50) WITHIN GROUP (
            ORDER BY
              accuracy
          ) as p50,
          percentile_disc(0.75) WITHIN GROUP (
            ORDER BY
              accuracy
          ) as p75,
          percentile_disc(0.90) WITHIN GROUP (
            ORDER BY
              accuracy
          ) as p90,
          percentile_disc(1) WITHIN GROUP (
            ORDER BY
              accuracy
          ) as p100
        FROM
          logs
        WHERE
          created > now() - ${{ minute: "60 minutes", hour: "72 hours", day: "60 days" }[
          period
        ]}::interval
        GROUP BY
          time
        ORDER BY
          time
      `,
    );
  }
  return res.status(400).json({
    error: "Invalid type",
  });
};
