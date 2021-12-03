export default async (req, res) => {
  res.json(Array.from(req.app.locals.workerPool));
};
