import "dotenv/config";
import { default as request } from "supertest";
import app from "./app.js";

test("GET /status", async () => {
  const response = await request(app).get("/status");
  expect(response.statusCode).toBe(200);
  expect(response.headers["content-type"]).toMatch(/^application\/json/);
  expect(typeof response.body).toBe("object");
  let numDocs = 0;
  let totalSize = 0;
  let lastModified = new Date(0);
  for (const [_, server] of Object.entries(response.body)) {
    for (const core of server) {
      numDocs += core.index.numDocs;
      totalSize += core.index.sizeInBytes;
      lastModified =
        lastModified > new Date(core.index.lastModified)
          ? lastModified
          : new Date(core.index.lastModified);
    }
  }
  expect(numDocs).toBeGreaterThanOrEqual(0);
  expect(numDocs).toBeGreaterThanOrEqual(0);
  expect(lastModified).toBeInstanceOf(Date);
});
