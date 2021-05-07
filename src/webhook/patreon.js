import fetch from "node-fetch";
import Knex from "knex";
import crypto from "crypto";

const {
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  WEBHOOK_PATREON_SECRET,
  SENDGRID_API_KEY,
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
  const signature = req.header("X-Patreon-Signature");
  if (!signature || !req.rawBody) {
    res.status(403).send("403 Forbidden");
    return;
  }
  const hmac = crypto.createHmac("md5", WEBHOOK_PATREON_SECRET);
  const digest = `${hmac.update(req.rawBody).digest("hex")}`;
  if (
    signature.length !== digest.length ||
    !crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))
  ) {
    res.status(403).send("403 Forbidden");
    return;
  }
  await knex("webhook").insert({ type: "patreon", json: req.rawBody });

  const {
    data: {
      attributes: { patron_status, email },
    },
    included,
  } = req.body;
  if (!email) {
    continue;
  }
  if (patron_status === "active_patron") {
    const rewardTierID = included
      .filter((e) => e.type === "tier")
      .sort((a, b) => b.attributes.amount - a.attributes.amount)
      .map((e) => e.id)[0];
    if (rewardTierID) {
      const tier = (
        await knex("tier").select("id").where("patreon_id", Number(rewardTierID)).limit(1)
      )[0].id;
      const rows = await knex("user").select("*").where("email", email).limit(1);
      if (!rows.length) {
        let hmac = crypto.createHmac("sha256", TRACE_API_SALT);
        const plainPassword = crypto
          .randomBytes(16)
          .toString("base64")
          .replace(/[^0-9a-zA-Z]/g, "");
        const password = hmac.update(plainPassword).digest("hex");
        hmac = crypto.createHmac("sha256", TRACE_API_SALT);
        const api_key = hmac.update(crypto.randomBytes(16)).digest("hex");
        await knex("user").insert({ email, password, api_key, tier });
      } else {
        await knex("user").where("email", email).update({ tier });
      }
    }
  } else if (patron_status === "declined_patron") {
    await knex("user").where("email", email).update({ tier: 0 });
  }

  // if (SENDGRID_API_KEY) {
  //   await fetch("https://api.sendgrid.com/v3/mail/send", {
  //     method: "POST",
  //     headers: {
  //       Authorization: `Bearer ${SENDGRID_API_KEY}`,
  //       "Content-Type": "application/json",
  //     },
  //     body: JSON.stringify({
  //       personalizations: [{ to: [{ email: "soruly@gmail.com" }] }],
  //       from: { email: "no-reply@trace.moe" },
  //       subject: "Sending with SendGrid is Fun",
  //       content: [{ type: "text/plain", value: "and easy to do anywhere, even with cURL" }],
  //     }),
  //   });
  // }

  res.json({});
};
