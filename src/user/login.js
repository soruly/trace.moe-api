import Knex from "knex";

const {
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  TRACE_MEDIA_SALT,
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
  if (!req.body.email || !req.body.password) {
    return res.status(403).json({
      error: "Invalid Email or Password",
    });
  }
  const rows = await knex("user").select("api_key").where({
    email: req.body.email,
    password: req.body.password,
  });
  if (rows.length) {
    return res.json({
      key: rows[0].api_key,
    });
  }
  return res.status(403).json({
    error: "Invalid Email or Password",
  });
};
