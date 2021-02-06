export default async (req, res) => {
  res.json(
    await new Promise((resolve) => {
      req.app.locals.ws.send("getWorkerPool");
      req.app.locals.ws.on("message", (message) => {
        resolve(JSON.parse(message));
      });
    })
  );
};
