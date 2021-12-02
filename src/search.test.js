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
      .then((arrayBuffer) => fs.outputFile("32B15UXxymfSMwKGTObY5e.jpg", Buffer.from(arrayBuffer)));
  }
  const response = await request(app).post("/search").attach("image", "32B15UXxymfSMwKGTObY5e.jpg");
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
