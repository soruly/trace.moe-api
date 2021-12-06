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
  await app.locals.knex("user").where("email", "user@trace.moe").del();
  await app.locals.knex("user").insert({
    id: 1000,
    email: "user@trace.moe",
    password: "password",
    api_key: "2zd3HL8cfKqdc4BVsTwuw4QhNa7diKYjweE3zlP",
    tier: 9,
    notes: "Test Account",
  });
  app.locals.userApiKey = "2zd3HL8cfKqdc4BVsTwuw4QhNa7diKYjweE3zlP";
  await app.locals.knex("user").where("email", "admin@trace.moe").del();
});

afterAll(async () => {
  await app.locals.knex("user").where("email", "admin@trace.moe").del();
  await app.locals.knex("user").where("email", "user@trace.moe").del();
  await app.locals.knex("user").where("email", "test@trace.moe").del();
  await app.locals.knex.destroy();
});

describe("Create user without valid system API key", () => {
  test("/user/create without API Key", async () => {
    const response = await request(app).post("/user/create");
    expect(response.statusCode).toBe(403);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.error).toBe("string");
  });

  test("/user/create with invalid API Key", async () => {
    const response = await request(app).post("/user/create").query({ key: "A" });
    expect(response.statusCode).toBe(403);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.error).toBe("string");
  });

  test("/user/create with non-system API Key", async () => {
    const response = await request(app).post("/user/create").query({ key: app.locals.userApiKey });
    expect(response.statusCode).toBe(403);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.error).toBe("string");
  });
});

describe("Create user with valid system API key", () => {
  describe.each([
    ["No email address", { email: "" }],
    ["Invalid email address", { email: "email" }],
    ["Missing tier", { email: "admin@trace.moe" }],
    ["Invalid tier", { email: "admin@trace.moe", tier: -1 }],
    ["Already existed email", { email: "test@trace.moe", tier: 1 }],
  ])("%s", (_, data) => {
    test("POST /create", async () => {
      const response = await request(app)
        .post("/user/create")
        .query({ key: app.locals.apiKey })
        .send(data);
      expect(response.statusCode).toBe(400);
      expect(response.headers["content-type"]).toMatch(/^application\/json/);
      expect(typeof response.body.error).toBe("string");
    });
  });

  test("POST /create", async () => {
    const response = await request(app)
      .post("/user/create")
      .query({ key: app.locals.apiKey })
      .send({ email: "admin@trace.moe", tier: 1 });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body).toBe("object");
  }, 10000);
});
