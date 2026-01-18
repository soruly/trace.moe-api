import crypto from "node:crypto";
import sql from "../../sql.ts";

const { TRACE_API_SALT } = process.env;

export default async (req, res) => {
  if (!req.body?.email || !req.body?.password) {
    return res.status(403).json({
      error: "Invalid Email or Password",
    });
  }
  const rows = await sql`
    SELECT
      api_key
    FROM
      users
    WHERE
      email = ${req.body.email}
      AND password = ${crypto.scryptSync(req.body.password, TRACE_API_SALT, 64).toString("base64")}
    LIMIT
      1
  `;

  if (rows.length) {
    return res.json({
      key: rows[0].api_key,
    });
  }
  return res.status(403).json({
    error: "Invalid Email or Password",
  });
};
