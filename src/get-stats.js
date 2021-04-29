import Knex from "knex";

const {
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  HASH_PATH,
  TRACE_ALGO,
} = process.env;

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
  const { type, period } = req.query;
  if (!["hourly", "monthly", "daily"].includes(period)) {
    return res.status(400).json({
      error: "Invalid period",
    });
  }
  if (type === "traffic") {
    const rows = await knex(`log_${period}`);
    return res.json(rows.slice(-36));
  }
  if (type === "performance") {
    const rows = await knex(`log_speed_${period}`);
    return res.json(rows.slice(-36));
  }
  return res.status(400).json({
    error: "Invalid param",
  });
};
