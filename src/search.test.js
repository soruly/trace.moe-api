import "dotenv/config";
import { default as request } from "supertest";
import Knex from "knex";
import { createClient } from "redis";
import fetch from "node-fetch";
import fs from "fs-extra";
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

describe("without API Key", () => {
  test("/search by image URL", async () => {
    const response = await request(app)
      .get("/search")
      .query({ url: "https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.frameCount).toBe("number");
    expect(typeof response.body.error).toBe("string");
    expect(Array.isArray(response.body.result)).toBeTruthy();
    const topResult = response.body.result[0];
    expect(typeof topResult.anilist).toBe("number");
    expect(typeof topResult.filename).toBe("string");
    expect(typeof topResult.episode).toBe("number");
    expect(typeof topResult.from).toBe("number");
    expect(typeof topResult.to).toBe("number");
    expect(typeof topResult.similarity).toBe("number");
    expect(typeof topResult.video).toBe("string");
    expect(typeof topResult.image).toBe("string");
    expect(topResult.anilist).toBe(21034);
    expect(topResult.episode).toBe(1);
    expect(topResult.similarity).toBeGreaterThan(0.9);
  });

  test("/search by file upload", async () => {
    if (!fs.existsSync("32B15UXxymfSMwKGTObY5e.jpg")) {
      await fetch("https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg")
        .then((e) => e.arrayBuffer())
        .then((arrayBuffer) =>
          fs.outputFile("32B15UXxymfSMwKGTObY5e.jpg", Buffer.from(arrayBuffer))
        );
    }
    const response = await request(app)
      .post("/search")
      .attach("image", "32B15UXxymfSMwKGTObY5e.jpg");
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.frameCount).toBe("number");
    expect(typeof response.body.error).toBe("string");
    expect(Array.isArray(response.body.result)).toBeTruthy();
    const topResult = response.body.result[0];
    expect(typeof topResult.anilist).toBe("number");
    expect(typeof topResult.filename).toBe("string");
    expect(typeof topResult.episode).toBe("number");
    expect(typeof topResult.from).toBe("number");
    expect(typeof topResult.to).toBe("number");
    expect(typeof topResult.similarity).toBe("number");
    expect(typeof topResult.video).toBe("string");
    expect(typeof topResult.image).toBe("string");
    expect(topResult.anilist).toBe(21034);
    expect(topResult.episode).toBe(1);
    expect(topResult.similarity).toBeGreaterThan(0.9);
    await fs.remove("32B15UXxymfSMwKGTObY5e.jpg");
  });

  test("/search by image URL with cutBorders", async () => {
    const response = await request(app)
      .get("/search?cutBorders")
      .query({ url: "https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.frameCount).toBe("number");
    expect(typeof response.body.error).toBe("string");
    expect(Array.isArray(response.body.result)).toBeTruthy();
    const topResult = response.body.result[0];
    expect(typeof topResult.anilist).toBe("number");
    expect(typeof topResult.filename).toBe("string");
    expect(typeof topResult.episode).toBe("number");
    expect(typeof topResult.from).toBe("number");
    expect(typeof topResult.to).toBe("number");
    expect(typeof topResult.similarity).toBe("number");
    expect(typeof topResult.video).toBe("string");
    expect(typeof topResult.image).toBe("string");
    expect(topResult.anilist).toBe(21034);
    expect(topResult.episode).toBe(1);
    expect(topResult.similarity).toBeGreaterThan(0.9);
  });

  test("/search by image URL with anilistInfo", async () => {
    const response = await request(app)
      .get("/search?anilistInfo")
      .query({ url: "https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.frameCount).toBe("number");
    expect(typeof response.body.error).toBe("string");
    expect(Array.isArray(response.body.result)).toBeTruthy();
    const topResult = response.body.result[0];
    expect(typeof topResult.anilist).toBe("object");
    expect(typeof topResult.filename).toBe("string");
    expect(typeof topResult.episode).toBe("number");
    expect(typeof topResult.from).toBe("number");
    expect(typeof topResult.to).toBe("number");
    expect(typeof topResult.similarity).toBe("number");
    expect(typeof topResult.video).toBe("string");
    expect(typeof topResult.image).toBe("string");
    expect(topResult.anilist.id).toBe(21034);
    expect(topResult.episode).toBe(1);
    expect(topResult.similarity).toBeGreaterThan(0.9);
  });

  test("/search by image URL with anilist filter", async () => {
    const response = await request(app)
      .get("/search")
      .query({ url: "https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg", anilistID: 21034 });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.frameCount).toBe("number");
    expect(typeof response.body.error).toBe("string");
    expect(Array.isArray(response.body.result)).toBeTruthy();
    expect(response.body.result.every((e) => e.anilist === 21034)).toBeTruthy();
    const topResult = response.body.result[0];
    expect(typeof topResult.anilist).toBe("number");
    expect(typeof topResult.filename).toBe("string");
    expect(typeof topResult.episode).toBe("number");
    expect(typeof topResult.from).toBe("number");
    expect(typeof topResult.to).toBe("number");
    expect(typeof topResult.similarity).toBe("number");
    expect(typeof topResult.video).toBe("string");
    expect(typeof topResult.image).toBe("string");
    expect(topResult.episode).toBe(1);
    expect(topResult.similarity).toBeGreaterThan(0.9);
  });
});

describe("with API Key", () => {
  test("/search by image URL with API Key", async () => {
    const response = await request(app).get("/search").query({
      url: "https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg",
      key: "ZQDut2W0OqGeSme4Iil6YjIXH0r4Hlq5qq1DEoHDnQ",
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.frameCount).toBe("number");
    expect(typeof response.body.error).toBe("string");
    expect(Array.isArray(response.body.result)).toBeTruthy();
    const topResult = response.body.result[0];
    expect(typeof topResult.anilist).toBe("number");
    expect(typeof topResult.filename).toBe("string");
    expect(typeof topResult.episode).toBe("number");
    expect(typeof topResult.from).toBe("number");
    expect(typeof topResult.to).toBe("number");
    expect(typeof topResult.similarity).toBe("number");
    expect(typeof topResult.video).toBe("string");
    expect(typeof topResult.image).toBe("string");
    expect(topResult.anilist).toBe(21034);
    expect(topResult.episode).toBe(1);
    expect(topResult.similarity).toBeGreaterThan(0.9);
  });
});

describe("invalid input", () => {
  test("/search with wrong HTTP Method", async () => {
    // Method Not Allowed
    const response = await request(app).get("/search");
    expect(response.statusCode).toBe(405);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.error).toBe("string");
  });
  test("/search by image URL with invalid URL", async () => {
    // Invalid image url
    const response = await request(app).get("/search").query({ url: "explosion" });
    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.error).toBe("string");
  });
  test("/search by image URL with inaccessible image URL", async () => {
    // Failed to fetch image
    const response = await request(app).get("/search").query({ url: "https://0.0.0.0" });
    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.error).toBe("string");
  });
  test("/search by image URL with invalid image", async () => {
    // Failed to process image
    const response = await request(app).get("/search").query({ url: "https://media.trace.moe" });
    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.error).toBe("string");
  });
  test("/search by image URL with invalid API Key", async () => {
    // Invalid API key
    const response = await request(app).get("/search").query({ key: "explosion" });
    expect(response.statusCode).toBe(403);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.error).toBe("string");
  });
});

describe.each([
  ["16:9 in 16:9,  no border", "https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg"],
  ["16:9 in 16:10, #000 border", "https://images.plurk.com/I7r7frYsuiYcyWTmC8DAL.jpg"],
])("%s", (_, url, expected) => {
  test("/search by image URL with cutBorders", async () => {
    const response = await request(app).get("/search?cutBorders").query({ url });
    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.frameCount).toBe("number");
    expect(typeof response.body.error).toBe("string");
    expect(Array.isArray(response.body.result)).toBeTruthy();
    const topResult = response.body.result[0];
    expect(typeof topResult.anilist).toBe("number");
    expect(typeof topResult.filename).toBe("string");
    expect(typeof topResult.episode).toBe("number");
    expect(typeof topResult.from).toBe("number");
    expect(typeof topResult.to).toBe("number");
    expect(typeof topResult.similarity).toBe("number");
    expect(typeof topResult.video).toBe("string");
    expect(typeof topResult.image).toBe("string");
    expect(topResult.anilist).toBe(21034);
    expect(topResult.episode).toBe(1);
    expect(topResult.similarity).toBeGreaterThan(0.9);
  });
});
