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
    password:
      "/NkTzp68WWIaT30OYsGG/2zd3HL8cfKqdc4BVsTwuw4QhNa7diKYjweE3zlP/vxDWZ12MOFJ9YdylvkPDvJ6ww==",
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

describe("/user/login without email or password", () => {
  test("no email no password", async () => {
    const response = await request(app).post("/user/login");
    expect(response.statusCode).toBe(403);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.error).toBe("string");
  });
  test("no password", async () => {
    const response = await request(app).post("/user/login").send({ email: "test@trace.moe" });
    expect(response.statusCode).toBe(403);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.error).toBe("string");
  });
  test("no email", async () => {
    const response = await request(app).post("/user/login").send({ password: "test@trace.moe" });
    expect(response.statusCode).toBe(403);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.error).toBe("string");
  });
});

describe("/user/login with invalid email or password", () => {
  test("Invalid email", async () => {
    const response = await request(app)
      .post("/user/login")
      .send({ email: "nobody@trace.moe", password: "A" });
    expect(response.statusCode).toBe(403);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.error).toBe("string");
  });
  test("Valid email wrong password", async () => {
    const response = await request(app)
      .post("/user/login")
      .send({ email: "test@trace.moe", password: "A" });
    expect(response.statusCode).toBe(403);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.error).toBe("string");
  });
});

describe("/user/login with valid email and password", () => {
  test("should return apiKey", async () => {
    const response = await request(app)
      .post("/user/login")
      .send({ email: "test@trace.moe", password: "password" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.key).toBe("string");
    expect(response.body.key).toBe(app.locals.apiKey);
  });
});
