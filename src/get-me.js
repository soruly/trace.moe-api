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
  let user = {
    id: req.ip,
    email: "",
    rate_limit: 10,
    monthly_quota: 3000,
    monthly_search: 0,
  };

  const apiKey = req.query.key ?? req.header("x-trace-key") ?? "";
  if (apiKey) {
    const rows = await knex("user")
      .select("id", "email", "rate_limit", "monthly_quota", "monthly_search")
      .where("api_key", apiKey);

    if (rows.length === 0) {
      return res.status(403).json({
        error: "Invalid API key",
      });
    } else {
      user = rows[0];
    }
  }

  res.json({
    id: `${user.id}`,
    email: user.email,
    rate_limit: user.rate_limit,
    monthly_quota: user.monthly_quota,
    monthly_search: user.monthly_search,
  });
};
