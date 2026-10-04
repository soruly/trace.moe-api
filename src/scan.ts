import crypto from "node:crypto";

function isValidSecret(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

export default async (req, res) => {
  const expectedSecret = process.env.SCAN_SECRET;
  if (!expectedSecret) {
    console.error("[scan] SCAN_SECRET is not configured");
    return res.status(500).json({ error: "SCAN_SECRET is not configured on server" });
  }

  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");

  if (!token || !isValidSecret(token, expectedSecret)) {
    return res.status(403).json({
      error: "403 Forbidden: Invalid secret token",
    });
  }

  let anilistId: number | undefined;
  if (req.params?.id) {
    if (!/^\d+$/.test(req.params.id)) {
      return res.status(400).json({ error: "Invalid anilist id: must be a number" });
    }
    anilistId = Number(req.params.id);
  }

  const taskManager = req.app.locals.taskManager;
  if (!taskManager) {
    return res.status(500).json({ error: "Task manager not initialized" });
  }

  const isRunning = taskManager.isScanTaskRunning;
  taskManager.runScanTask(undefined, anilistId).catch(console.error);

  return res.json({
    status: "ok",
    message: isRunning
      ? anilistId
        ? `Scan already running; folder ${anilistId} queued`
        : "Scan already running; next scan queued"
      : anilistId
        ? `Scan started for ${anilistId}`
        : "Scan started",
    ...(anilistId ? { anilist_id: anilistId } : {}),
  });
};
