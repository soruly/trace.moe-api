import Knex from "knex";
import crypto from "crypto";
import createNewUser from "../../lib/create-new-user.js";

const {
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  WEBHOOK_PATREON_SECRET,
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
      attributes: { patron_status, email, full_name },
    },
    included,
  } = req.body;

  if (email && patron_status === "active_patron") {
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
        const result = await createNewUser(email, tier, full_name);
        console.log(result);
      } else {
        await knex("user").where("email", email).update({ tier });
      }
    }
  } else if (patron_status === "declined_patron") {
    await knex("user").where("email", email).update({ tier: 0 });
  }

  res.json({});
};
