import crypto from "node:crypto";
import sql from "../../sql.js";
import createNewUser from "../lib/create-new-user.js";

const { WEBHOOK_PATREON_SECRET } = process.env;

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
  await sql`
    INSERT INTO
      webhook (source, json)
    VALUES
      ('PATREON', ${JSON.parse(req.rawBody)})
  `;

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
        await sql`
          SELECT
            id
          FROM
            tiers
          WHERE
            patreon_id = ${Number(rewardTierID)}
          LIMIT
            1
        `
      )[0].id;
      const rows = await sql`
        SELECT
          *
        FROM
          users
        WHERE
          email = ${email}
        LIMIT
          1
      `;
      if (!rows.length) {
        const result = await createNewUser(email, tier, full_name);
        console.log(result);
      } else {
        await sql`
          UPDATE users
          SET
            tier = ${tier}
          WHERE
            email = ${email}
          LIMIT
            1
        `;
      }
    }
  } else if (email && patron_status === "declined_patron") {
    const rows = await sql`
      SELECT
        *
      FROM
        users
      WHERE
        email = ${email}
      LIMIT
        1
    `;
    if (rows.length) {
      await sql`
        UPDATE users
        SET
          tier = 0
        WHERE
          email = ${email}
        LIMIT
          1
      `;
    }
  }

  res.json({});
};
