import "dotenv/config";
import { default as request } from "supertest";
import Knex from "knex";
import app from "./app.js";

const { SOLA_DB_HOST, SOLA_DB_PORT, SOLA_DB_USER, SOLA_DB_PWD, SOLA_DB_NAME } = process.env;

beforeAll(async () => {
  app.locals.knex = Knex({
    client: "mysql",
    connection: {
      host: SOLA_DB_HOST,
      port: SOLA_DB_PORT,
      user: SOLA_DB_USER,
      password: SOLA_DB_PWD,
      database: SOLA_DB_NAME,
      multipleStatements: true,
    },
  });
});

afterAll(async () => {
  await app.locals.knex.destroy();
});

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

test("GET /status?id=a", async () => {
  const response = await request(app).get("/status?id=a");
  expect(response.statusCode).toBe(400);
  expect(response.headers["content-type"]).toMatch(/^application\/json/);
  expect(typeof response.body).toBe("object");
});

test("GET /status?id=1", async () => {
  const response = await request(app).get("/status?id=1");
  expect(response.statusCode).toBe(200);
  expect(response.headers["content-type"]).toMatch(/^application\/json/);
  expect(Array.isArray(response.body)).toBeTruthy();
});
