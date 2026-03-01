import crypto from "node:crypto";

import sql from "../../sql.ts";

const { WEBHOOK_GITHUB_SECRET } = process.env;

export default async (req, res) => {
  if (!WEBHOOK_GITHUB_SECRET) {
    console.error("[GitHub Webhook] WEBHOOK_GITHUB_SECRET is not set");
    res.status(500).send("500 Internal Server Error");
    return;
  }

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
  try {
    await sql`
      INSERT INTO
        webhook (source, json)
      VALUES
        ('GITHUB', ${JSON.parse(req.rawBody)})
    `;
    res.json({});
  } catch (err) {
    console.error("[GitHub Webhook] Unhandled error", err);
    res.status(500).send("500 Internal Server Error");
  }
};
