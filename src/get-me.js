import sql from "../sql.js";

export default async (req, res) => {
  let email = "";
  let priority = 0;
  let concurrency = 0;
  let quota = 0;
  let quotaUsed = 0;

  const apiKey = req.query.key ?? req.header("x-trace-key") ?? "";
  if (apiKey) {
    const [user] =
      await sql`SELECT id, email, quota, quota_used, priority, concurrency FROM users_view WHERE api_key=${apiKey}`;

    if (!user) {
      return res.status(403).json({
        error: "Invalid API key",
      });
    } else {
      email = user.email;
      priority = user.priority;
      concurrency = user.concurrency;
      quota = user.quota;
      quotaUsed = user.quota_used;
    }
  } else {
    const [defaultTier] = await sql`SELECT priority, concurrency, quota FROM tiers WHERE id=0`;
    priority = defaultTier.priority;
    concurrency = defaultTier.concurrency;
    quota = defaultTier.quota;

    const [quota] = await sql`SELECT used FROM quota WHERE ip=${req.ip}`;
    quotaUsed = quota?.used ?? 0;
  }

  res.json({
    id: apiKey ? email : req.ip,
    priority,
    concurrency,
    quota,
    quotaUsed,
  });
};
