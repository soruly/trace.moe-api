import sql from "../sql.ts";

export default async (req, res) => {
  const { period } = req.query;

  if (period && !["minute", "hour", "day"].includes(period)) {
    return res.status(400).json({ error: "Invalid period" });
  }

  let user = null;
  if (req.header("x-trace-key")) {
    const [foundUser] = await sql`
      SELECT
        id,
        email,
        quota,
        quota_used,
        priority,
        concurrency
      FROM
        users_view
      WHERE
        api_key = ${req.header("x-trace-key")}
    `;

    if (!foundUser) {
      return res.status(403).json({
        error: "Invalid API key",
      });
    }
    user = foundUser;
  }

  if (period) {
    const rows = await sql`
      SELECT
        date_trunc(${period}, created) AS date_time,
        code,
        COUNT(*)
      FROM
        logs
      WHERE
        ${user
          ? sql`user_id = ${user.id}`
          : sql`
              network = CASE
                WHEN family(${req.ip}) = 6 THEN set_masklen(${req.ip}::cidr, 64)
                ELSE set_masklen(${req.ip}::cidr, 32)
              END
            `}
        AND created > now() - ${{ minute: "60 minutes", hour: "72 hours", day: "60 days" }[
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
  }

  let priority = 0;
  let concurrency = 0;
  let quota = 0;
  let quotaUsed = 0;
  let id = req.ip;

  if (user) {
    id = user.email;
    priority = user.priority;
    concurrency = user.concurrency;
    quota = user.quota;
    quotaUsed = user.quota_used;
  } else {
    const [row] = await sql`
      SELECT
        network,
        quota_used,
        quota,
        priority,
        concurrency
      FROM
        logs_view
      WHERE
        network = CASE
          WHEN family(${req.ip}) = 6 THEN set_masklen(${req.ip}::cidr, 64)
          ELSE set_masklen(${req.ip}::cidr, 32)
        END
    `;
    if (row) {
      id = row.network;
      priority = row.priority;
      concurrency = row.concurrency;
      quota = row.quota;
      quotaUsed = row.quota_used;
    } else {
      const [row] = await sql`
        SELECT
          priority,
          concurrency,
          quota
        FROM
          tiers
        WHERE
          id = 0
      `;
      priority = row.priority;
      concurrency = row.concurrency;
      quota = row.quota;
      quotaUsed = 0;
    }
  }

  res.json({
    id,
    priority,
    concurrency,
    quota,
    quotaUsed,
  });
};
