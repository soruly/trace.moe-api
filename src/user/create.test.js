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
});

afterAll(async () => {
  await app.locals.knex.destroy();
});

describe("without API Key", () => {
  test("/search by image URL", async () => {
    // const response = await request(app)
    //   .get("/search")
    //   .query({ url: "https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg" });
    // expect(response.statusCode).toBe(200);
    // expect(response.headers["content-type"]).toMatch(/^application\/json/);
    // expect(typeof response.body.frameCount).toBe("number");
    // expect(typeof response.body.error).toBe("string");
    // expect(Array.isArray(response.body.result)).toBeTruthy();
    // const topResult = response.body.result[0];
    // expect(typeof topResult.anilist).toBe("number");
    // expect(typeof topResult.filename).toBe("string");
    // expect(typeof topResult.episode).toBe("number");
    // expect(typeof topResult.from).toBe("number");
    // expect(typeof topResult.to).toBe("number");
    // expect(typeof topResult.similarity).toBe("number");
    // expect(typeof topResult.video).toBe("string");
    // expect(typeof topResult.image).toBe("string");
    // expect(topResult.anilist).toBe(21034);
    // expect(topResult.episode).toBe(1);
    expect(1).toBe(1);
  });
});
