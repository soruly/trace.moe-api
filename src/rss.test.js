import "dotenv/config";
import { default as request } from "supertest";
import Knex from "knex";
import app from "./app.js";

const { SOLA_DB_HOST, SOLA_DB_PORT, SOLA_DB_USER, SOLA_DB_PWD, SOLA_DB_NAME, TRACE_ALGO } =
  process.env;

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
  await app.locals.knex(TRACE_ALGO).truncate();
  await app.locals.knex(TRACE_ALGO).insert({
    path: "21034/Gochuumon wa Usagi Desuka 2 - 01 (BD 1280x720 x264 AAC).mp4",
    status: "LOADED",
    created: new Date(),
    updated: new Date(),
  });
});

afterAll(async () => {
  await app.locals.knex(TRACE_ALGO).truncate();
  await app.locals.knex.destroy();
});

test("GET /rss.xml", async () => {
  const response = await request(app).get("/rss.xml");
  expect(response.statusCode).toBe(200);
  expect(response.headers["content-type"]).toMatch(/^text\/xml/);
  expect(typeof response.text).toBe("string");
});

test("GET /rss.xml with invalid offset", async () => {
  const response = await request(app).get("/rss.xml").query({ offset: "A" });
  expect(response.statusCode).toBe(200);
  expect(response.headers["content-type"]).toMatch(/^text\/xml/);
  expect(typeof response.text).toBe("string");
});

test("GET /rss.xml with invalid limit", async () => {
  const response = await request(app).get("/rss.xml").query({ limit: 0 });
  expect(response.statusCode).toBe(200);
  expect(response.headers["content-type"]).toMatch(/^text\/xml/);
  expect(typeof response.text).toBe("string");
});

test("GET /rss.xml with very large limit", async () => {
  const response = await request(app).get("/rss.xml").query({ limit: 9999 });
  expect(response.statusCode).toBe(200);
  expect(response.headers["content-type"]).toMatch(/^text\/xml/);
  expect(typeof response.text).toBe("string");
});
