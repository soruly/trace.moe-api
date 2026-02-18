export default async (req, res) => {
  await req.app.locals.taskManager.runScanTask(60);
  return res.json({ ok: true });
};
