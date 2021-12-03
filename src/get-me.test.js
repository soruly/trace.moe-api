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
  await app.locals.knex("user").where("email", "test@trace.moe").del();
  await app.locals.knex("user").insert({
    id: 101,
    email: "test@trace.moe",
    password: "password",
    api_key: "OwTPRvfpSg5kw1Gjww33ahbA3tEnu0DnseOIcHJt4g",
    tier: 9,
    notes: "Test Account",
  });
  app.locals.apiKey = "OwTPRvfpSg5kw1Gjww33ahbA3tEnu0DnseOIcHJt4g";
});

afterAll(async () => {
  await app.locals.knex("user").where("email", "test@trace.moe").del();
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
