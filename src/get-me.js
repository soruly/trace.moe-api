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
    id: null,
    email: req.ip,
    rate_limit: 60,
    monthly_quota: null,
    search_count: null,
  };

  if (req.query.token) {
    const result = await knex("user")
      .select("id", "email", "rate_limit", "monthly_quota", "search_count")
      .where("api_key", req.query.token);

    if (result.length === 0) {
      res.status(403).send(`"error: invalid token"`);
      return;
    } else {
      user = result[0];
    }
  }

  res.json({
    id: user.id,
    email: user.email,
    rate_limit: user.rate_limit,
    monthly_quota: user.monthly_quota,
    search_count: user.search_count,
  });
};
