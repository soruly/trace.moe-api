import Knex from "knex";

const { SOLA_DB_HOST, SOLA_DB_PORT, SOLA_DB_USER, SOLA_DB_PWD, SOLA_DB_NAME } = process.env;

const knex = Knex({
  client: "mysql",
  connection: {
    host: SOLA_DB_HOST,
    port: SOLA_DB_PORT,
    user: SOLA_DB_USER,
    password: SOLA_DB_PWD,
    database: SOLA_DB_NAME,
  },
});

export default async (req, res) => {
  let uid = "";
  let email = "";
  let rateLimit = 0;
  let concurrency = 0;
  let quota = 0;

  const apiKey = req.query.key ?? req.header("x-trace-key") ?? "";
  if (apiKey) {
    const rows = await knex("user_view")
      .select("id", "email", "rate_limit", "concurrency", "quota")
      .where("api_key", apiKey);

    if (rows.length === 0) {
      return res.status(403).json({
        error: "Invalid API key",
      });
    } else {
      uid = rows[0].id;
      email = rows[0].email;
      rateLimit = rows[0].rate_limit;
      concurrency = rows[0].concurrency;
      quota = rows[0].quota;
    }
  } else {
    const rows = await knex("tier").select("rate_limit", "concurrency", "quota").where("id", 0);
    uid = req.ip;
    email = "";
    rateLimit = rows[0].rate_limit;
    concurrency = rows[0].concurrency;
    quota = rows[0].quota;
  }
  const userQuota = await knex("user_quota").where("uid", uid);
  const quotaUsed = userQuota.length ? userQuota[0].count : 0;

  res.json({
    id: uid,
    email,
    rateLimit,
    concurrency,
    quota,
    quotaUsed,
  });
};
