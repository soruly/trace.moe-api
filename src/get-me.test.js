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
  app.locals.apiKey = (await app.locals.knex("user").select("api_key").where("id", 100))[0].api_key;
});

afterAll(async () => {
  await app.locals.redis.disconnect();
  await app.locals.knex.destroy();
});

test("GET /me", async () => {
  const response = await request(app).get("/me");
  expect(response.statusCode).toBe(200);
  expect(response.headers["content-type"]).toMatch(/^application\/json/);
  expect(typeof response.body.id).toBe("string");
  expect(typeof response.body.priority).toBe("number");
  expect(typeof response.body.concurrency).toBe("number");
  expect(typeof response.body.quota).toBe("number");
  expect(typeof response.body.quotaUsed).toBe("number");
});

test("GET /me with API key in URL", async () => {
  const response = await request(app).get("/me").query({ key: app.locals.apiKey });
  expect(response.statusCode).toBe(200);
  expect(response.headers["content-type"]).toMatch(/^application\/json/);
  expect(response.body.id).toMatch(/.+@.+/);
  expect(typeof response.body.priority).toBe("number");
  expect(typeof response.body.concurrency).toBe("number");
  expect(typeof response.body.quota).toBe("number");
  expect(typeof response.body.quotaUsed).toBe("number");
});

test("GET /me with API key in HTTP header", async () => {
  const response = await request(app).get("/me").set({ "x-trace-key": app.locals.apiKey });
  expect(response.statusCode).toBe(200);
  expect(response.headers["content-type"]).toMatch(/^application\/json/);
  expect(response.body.id).toMatch(/.+@.+/);
  expect(typeof response.body.priority).toBe("number");
  expect(typeof response.body.concurrency).toBe("number");
  expect(typeof response.body.quota).toBe("number");
  expect(typeof response.body.quotaUsed).toBe("number");
});

test("GET /me with invalid API key in URL", async () => {
  const response = await request(app).get("/me").query({ key: "explosion" });
  expect(response.statusCode).toBe(403);
  expect(response.headers["content-type"]).toMatch(/^application\/json/);
  expect(typeof response.body.error).toBe("string");
});
