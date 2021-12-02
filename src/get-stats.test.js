import "dotenv/config";
import { default as request } from "supertest";
import Knex from "knex";
import { createClient } from "redis";
import app from "./app.js";

const {
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  REDIS_HOST,
  REDIS_PORT,
} = process.env;

beforeAll(async () => {
  app.locals.redis = createClient({
    host: REDIS_HOST,
    port: REDIS_PORT,
  });
  await app.locals.redis.connect();
  // await app.locals.redis.flushAll();

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
  await app.locals.redis.disconnect();
  await app.locals.knex.destroy();
});

test("GET /stats", async () => {
  const response = await request(app).get("/stats");
  expect(response.statusCode).toBe(400);
  expect(response.headers["content-type"]).toMatch(/^application\/json/);
  expect(typeof response.body.error).toBe("string");
});

test("GET /stats?type=media", async () => {
  const response = await request(app).get("/stats").query({ type: "media" });
  expect(response.statusCode).toBe(200);
  expect(response.headers["content-type"]).toMatch(/^application\/json/);
  expect(typeof response.body.mediaCount).toBe("number");
  expect(typeof response.body.mediaFramesTotal).toBe("number");
  expect(typeof response.body.mediaDurationTotal).toBe("number");
  expect(typeof response.body.lastUpdate).toBe("string");
});

test("GET /stats?type=traffic", async () => {
  const response = await request(app).get("/stats").query({ type: "traffic" });
  expect(response.statusCode).toBe(400);
  expect(response.headers["content-type"]).toMatch(/^application\/json/);
  expect(typeof response.body.error).toBe("string");
});

test("GET /stats?type=traffic&period=hourly", async () => {
  const response = await request(app).get("/stats").query({ type: "traffic", period: "hourly" });
  expect(response.statusCode).toBe(200);
  expect(response.headers["content-type"]).toMatch(/^application\/json/);
  expect(Array.isArray(response.body)).toBeTruthy();
});

test("GET /stats?type=performance&period=hourly", async () => {
  const response = await request(app)
    .get("/stats")
    .query({ type: "performance", period: "hourly" });
  expect(response.statusCode).toBe(200);
  expect(response.headers["content-type"]).toMatch(/^application\/json/);
  expect(Array.isArray(response.body)).toBeTruthy();
});
