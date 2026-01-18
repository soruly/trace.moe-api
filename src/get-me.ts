import sql from "../sql.ts";

export default async (req, res) => {
  let priority = 0;
  let concurrency = 0;
  let quota = 0;
  let quotaUsed = 0;
  let id = req.ip;

  const apiKey = req.query.key ?? req.header("x-trace-key") ?? "";
  if (apiKey) {
    const [user] = await sql`
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
        api_key = ${apiKey}
    `;

    if (!user) {
      return res.status(403).json({
        error: "Invalid API key",
      });
    } else {
      id = user.email;
      priority = user.priority;
      concurrency = user.concurrency;
      quota = user.quota;
      quotaUsed = user.quota_used;
    }
  } else {
    const [defaultTier] = await sql`
      SELECT
        priority,
        concurrency,
        quota
      FROM
        tiers
      WHERE
        id = 0
    `;
    priority = defaultTier.priority;
    concurrency = defaultTier.concurrency;
    quota = defaultTier.quota;
    const [row] = await sql`
      SELECT
        network,
        SUM(used) AS used
      FROM
        quota
      WHERE
        network = CASE
          WHEN family(${req.ip}) = 6 THEN set_masklen(${req.ip}::cidr, 56)
          ELSE set_masklen(${req.ip}::cidr, 32)
        END
      GROUP BY
        network
    `;
    if (row) {
      id = row.network;
      quotaUsed = row.used;
    } else {
      const [row] = await sql`
        SELECT
          CASE
            WHEN family(${req.ip}) = 6 THEN set_masklen(${req.ip}::cidr, 56)
            ELSE set_masklen(${req.ip}::cidr, 32)
          END AS network
      `;
      id = row.network;
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
