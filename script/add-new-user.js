import "dotenv/config";
import Knex from "knex";
import createNewUser from "../lib/create-new-user.js";

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

const rows = await knex("webhook").select("*").where("type", "patreon").limit(1);
for (const row of rows) {
  const {
    data: {
      attributes: { patron_status, email, full_name },
    },
    included,
  } = JSON.parse(row.json);
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
        await createNewUser(email, tier, false, full_name);
      } else {
        await knex("user").where("email", email).update({ tier });
      }
    }
  } else if (patron_status === "declined_patron") {
    await knex("user").where("email", email).update({ tier: 0 });
  }
}
knex.destroy();

// await createNewUser("soruly@gmail.com", 1, true, "soruly");
