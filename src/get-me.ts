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
          WHEN family(${req.ip}) = 6 THEN set_masklen(${req.ip}::cidr, 56)
          ELSE set_masklen(${req.ip}::cidr, 32)
        END
    `;
    if (row) {
      id = row.network;
      priority = row.priority;
      concurrency = row.concurrency;
      quota = row.quota;
      quotaUsed = row.quota_used;
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
