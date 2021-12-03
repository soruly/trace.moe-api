import "dotenv/config";
import { default as request } from "supertest";
import Knex from "knex";
import app from "../app.js";

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

describe("/user/reset-password without valid API Key", () => {
  test("No API key", async () => {
    const response = await request(app).post("/user/reset-password").send({ password: "password" });
    expect(response.statusCode).toBe(403);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.error).toBe("string");
  });
  test("Invalid API Key", async () => {
    const response = await request(app)
      .post("/user/reset-password")
      .set({ "x-trace-key": "A" })
      .send({ password: "password" });
    expect(response.statusCode).toBe(403);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.error).toBe("string");
  });
});

describe("/user/reset-password with valid API Key", () => {
  test("Invalid password", async () => {
    const response = await request(app)
      .post("/user/reset-password")
      .set({ "x-trace-key": app.locals.apiKey })
      .send({ password: "A" });
    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.error).toBe("string");
  });
  test("Valid password", async () => {
    const response = await request(app)
      .post("/user/reset-password")
      .set({ "x-trace-key": app.locals.apiKey })
      .send({ password: "password" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body).toBe("object");
  }, 10000);
});
