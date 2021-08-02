export default async (req, res) => {
  req.app.locals.checkDB();
  res.json(Array.from(req.app.locals.workerPool));
};
