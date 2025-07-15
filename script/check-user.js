import sql from "../sql.js";

const rows = await sql`SELECT * FROM webhook WHERE source='PATREON' LIMIT 1`;
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
        await sql`SELECT id FROM tier WHERE patreon_id=${Number(rewardTierID)} LIMIT 1`
      )[0].id;
      console.log(tier);
      const rows = await sql`SELECT * FROM user WHERE email=${email} LIMIT 1`;
      if (!rows.length) {
        console.log("new", email);
        // await createNewUser(email, tier, false, full_name);
      } else {
        console.log("changed", email);
        // await sql`UPDATE user SET tier=${tier} WHERE email=${email}`;
      }
    }
  } else if (patron_status === "declined_patron") {
    console.log("declined", email);
    // await sql`UPDATE user SET tier=0 WHERE email=${email}`;
  }
}
await sql.end();
