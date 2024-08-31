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
  await app.locals.knex("file").truncate();
});

afterAll(async () => {
  await app.locals.knex("file").truncate();
  await app.locals.knex.destroy();
});

test("GET /scan", async () => {
  const response = await request(app).get("/scan");
  expect(response.statusCode).toBe(200);
});
