import fs from "node:fs/promises";

export default async (req, res) => {
  if (req.headers.accept?.toLowerCase() !== "text/event-stream") {
    res.set("Referrer-Policy", "no-referrer");
    res.set("X-Content-Type-Options", "nosniff");
    res.set("Cross-Origin-Resource-Policy", "same-origin");
    res.set(
      "Content-Security-Policy",
      [
        "default-src 'none'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "style-src 'self'",
        "img-src 'self'",
        "font-src 'self'",
        "script-src 'self' 'unsafe-inline'",
        "connect-src 'self'",
        "form-action 'self'",
        "media-src 'self'",
        "manifest-src 'self'",
        "worker-src 'self'",
        "block-all-mixed-content",
      ].join("; "),
    );
    return res.setHeader("Content-Type", "text/html").send(await fs.readFile("./src/tasks.html"));
  }
  res.set({
    "Cache-Control": "no-cache",
    "Content-Type": "text/event-stream",
  });
  res.flushHeaders();
  res.write("retry: 1000\n\n");
  req.app.locals.taskManager.subscribe(res);
};
