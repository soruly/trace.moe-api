export default async (req, res) => {
  const knex = req.app.locals.knex;

  let uid = "";
  let email = "";
  let priority = 0;
  let concurrency = 0;
  let quota = 0;

  const apiKey = req.query.key ?? req.header("x-trace-key") ?? "";
  if (apiKey) {
    const rows = await knex("user_view")
      .select("id", "email", "priority", "concurrency", "quota")
      .where("api_key", apiKey);

    if (rows.length === 0) {
      return res.status(403).json({
        error: "Invalid API key",
      });
    } else {
      uid = rows[0].id;
      email = rows[0].email;
      priority = rows[0].priority;
      concurrency = rows[0].concurrency;
      quota = rows[0].quota;
    }
  } else {
    const rows = await knex("tier").select("priority", "concurrency", "quota").where("id", 0);
    uid = req.ip;
    priority = rows[0].priority;
    concurrency = rows[0].concurrency;
    quota = rows[0].quota;
  }
  const userQuota = await knex("user_quota").where("uid", uid);
  const quotaUsed = userQuota.length ? userQuota[0].count : 0;

  res.json({
    id: apiKey ? email : uid,
    priority,
    concurrency,
    quota,
    quotaUsed,
  });
};
