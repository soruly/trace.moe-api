import crypto from "node:crypto";

const { WEBHOOK_GITHUB_SECRET } = process.env;

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
  await sql`INSERT INTO webhook (type, json) VALUES ('github', ${req.rawBody})`;
  res.json({});
};
