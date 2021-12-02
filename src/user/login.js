import crypto from "crypto";

const { TRACE_API_SALT } = process.env;

export default async (req, res) => {
  const knex = req.app.locals.knex;

  if (!req.body.email || !req.body.password) {
    return res.status(403).json({
      error: "Invalid Email or Password",
    });
  }
  const rows = await knex("user")
    .select("api_key")
    .where({
      email: req.body.email,
      password: crypto.scryptSync(req.body.password, TRACE_API_SALT, 64).toString("base64"),
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
