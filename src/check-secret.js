const { TRACE_API_SECRET } = process.env;

export default async (req, res, next) => {
  if (req.query.token !== TRACE_API_SECRET) {
    res.status(403).send("403 Forbidden");
    return;
  }
  next();
};
