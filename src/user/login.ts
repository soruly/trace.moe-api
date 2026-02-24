import sql from "../../sql.ts";
import hashPassword from "../lib/hash-password.ts";

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
      AND password = ${await hashPassword(req.body.password)}
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
