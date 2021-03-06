import Knex from "knex";
import crypto from "crypto";

const {
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  WEBHOOK_GITHUB_SECRET,
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
  const signature = req.header("X-Hub-Signature-256");
  if (!signature || !req.rawBody) {
    res.status(403).send("403 Forbidden");
    return;
  }
  const hmac = crypto.createHmac("sha256", WEBHOOK_GITHUB_SECRET);
  const digest = `sha256=${hmac.update(req.rawBody).digest("hex")}`;
  if (
    signature.length !== digest.length ||
    !crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))
  ) {
    res.status(403).send("403 Forbidden");
    return;
  }
  await knex("webhook").insert({ type: "github", json: req.rawBody });
  res.json({});
};
