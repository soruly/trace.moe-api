import crypto from "node:crypto";

import sql from "../../sql.ts";
import createNewUser from "../lib/create-new-user.ts";

const { WEBHOOK_PATREON_SECRET } = process.env;

export default async (req, res) => {
  if (!WEBHOOK_PATREON_SECRET) {
    console.error("[Patreon Webhook] WEBHOOK_PATREON_SECRET is not set");
    res.status(500).send("500 Internal Server Error");
    return;
  }

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

  try {
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
        .sort((a, b) => b.attributes.amount_cents - a.attributes.amount_cents)
        .map((e) => e.id)[0];
      if (rewardTierID) {
        const [tier] = await sql`
          SELECT
            id
          FROM
            tiers
          WHERE
            patreon_id = ${Number(rewardTierID)}
          LIMIT
            1
        `;
        if (tier) {
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
            const result = await createNewUser(email, tier.id, full_name);
            console.log(result);
          } else {
            await sql`
              UPDATE users
              SET
                tier = ${tier.id}
              WHERE
                email = ${email}
            `;
          }
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
        `;
      }
    }

    res.json({});
  } catch (err) {
    console.error("[Patreon Webhook] Unhandled error", err);
    res.status(500).send("500 Internal Server Error");
  }
};
