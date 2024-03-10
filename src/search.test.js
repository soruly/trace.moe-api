import "dotenv/config";
import { default as request } from "supertest";
import Knex from "knex";
import fs from "fs-extra";
import app from "./app.js";

const {
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  SOLA_SOLR_LIST,
  TRACE_ALGO,
} = process.env;

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
    id: 100,
    email: "user@trace.moe",
    password: "password",
    api_key: "OwOPRvfpSg5kw1Gjww33ahbA3tEnu0DnseOIcHJt3g",
    tier: 1,
    notes: "Test Account",
  });
  app.locals.apiKeyTier0 = "OwOPRvfpSg5kw1Gjww33ahbA3tEnu0DnseOIcHJt3g";
  await app.locals.knex("user").insert({
    id: 1000,
    email: "user@trace.moe",
    password: "password",
    api_key: "OwOPRvfpSg5kw1Gjww33ahbA3tEnu0DnseOIcHJt4g",
    tier: 1,
    notes: "Test Account",
  });
  app.locals.apiKeyTier1 = "OwOPRvfpSg5kw1Gjww33ahbA3tEnu0DnseOIcHJt4g";
  await app.locals.knex("user").insert({
    id: 1001,
    email: "test@trace.moe",
    password: "password",
    api_key: "OwOPRvfpSg5kw1Gjww33ahbA3tEnu0DnseOIcHJt5g",
    tier: 9,
    notes: "Test Account",
  });
  app.locals.apiKeyTier9 = "OwOPRvfpSg5kw1Gjww33ahbA3tEnu0DnseOIcHJt5g";
  await fetch(`${SOLA_SOLR_LIST}${TRACE_ALGO}_0/update?wt=json&commit=true`, {
    method: "POST",
    headers: { "Content-Type": "text/xml" },
    body: '<add><doc><field name="id">21034/Gochuumon wa Usagi Desuka 2 - 01 (BD 1280x720 x264 AAC).mp4/278.5000</field><field name="cl_hi">FQYdEg4VDQcLFg8NDw0WEBQTEBEQEQ4iEBAREQwlEBAOEBA=</field><field name="cl_ha">3eb d3c 20c 736 9d9 317 649 91a 582 db5 c5f c01 6af ccf 44f 96d 5f 26 b8b ed2 6a8 18d 369 59f bc5 b78 ac3 f9 44d d15 c9b 155 1d8 26f 3b3 11a 4cd 331 603 43d 1fb ed1 2c7 446 b92 ee6 848 c6e 8ec 85f 409 b9e aa 7b6 901 9f9 96f c28 d52 2bb 7f2 96c 561 a44 6ae e38 7a9 590 503 5eb c30 da1 632 16c f83 dbd 152 2ea 5f ac1 c2c 4cf aee f21 357 a02 9e 3a0 419 827 c1 a67 65d d2a 9a5 84b a05 d75 f78 c30</field></doc></add>',
  });
  await fetch(`${SOLA_SOLR_LIST}${TRACE_ALGO}_0/update?wt=json&commit=true`, {
    method: "POST",
    headers: { "Content-Type": "text/xml" },
    body: '<add><doc><field name="id">21034/Gochuumon wa Usagi Desuka 2 - 01 (BD 1280x720 x264 AAC).mp4/279.5000</field><field name="cl_hi">FQYdEg4VDQcLFg8NDw0WEBQTEBEQEQ4iEBAREQwlEBAOEBA=</field><field name="cl_ha">3eb d3c 20c 736 9d9 317 649 91a 582 db5 c5f c01 6af ccf 44f 96d 5f 26 b8b ed2 6a8 18d 369 59f bc5 b78 ac3 f9 44d d15 c9b 155 1d8 26f 3b3 11a 4cd 331 603 43d 1fb ed1 2c7 446 b92 ee6 848 c6e 8ec 85f 409 b9e aa 7b6 901 9f9 96f c28 d52 2bb 7f2 96c 561 a44 6ae e38 7a9 590 503 5eb c30 da1 632 16c f83 dbd 152 2ea 5f ac1 c2c 4cf aee f21 357 a02 9e 3a0 419 827 c1 a67 65d d2a 9a5 84b a05 d75 f78 c30</field></doc></add>',
  });
  await app.locals.knex(TRACE_ALGO).truncate();
  await app.locals.knex(TRACE_ALGO).insert({
    path: "21034/Gochuumon wa Usagi Desuka 2 - 01 (BD 1280x720 x264 AAC).mp4",
    status: "LOADED",
    created: new Date(),
    updated: new Date(),
  });
  await app.locals.knex("search_count").truncate();
  app.locals.searchQueue = [];
  app.locals.searchConcurrent = new Map();
});

afterAll(async () => {
  await app.locals.knex(TRACE_ALGO).truncate();
  await app.locals.knex("search_count").truncate();
  await app.locals.knex("user").where("email", "test@trace.moe").del();
  await app.locals.knex.destroy();
  if (fs.existsSync("32B15UXxymfSMwKGTObY5e.jpg")) await fs.remove("32B15UXxymfSMwKGTObY5e.jpg");
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
  test("/search by Form Post", async () => {
    if (!fs.existsSync("32B15UXxymfSMwKGTObY5e.jpg")) {
      await fetch("https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg")
        .then((e) => e.arrayBuffer())
        .then((arrayBuffer) =>
          fs.outputFile("32B15UXxymfSMwKGTObY5e.jpg", Buffer.from(arrayBuffer)),
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
  test("/search by file upload", async () => {
    const response = await request(app)
      .post("/search")
      .set("Content-Type", "image/jpeg")
      .send(
        Buffer.from(
          await fetch("https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg").then((e) =>
            e.arrayBuffer(),
          ),
        ),
      );
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

  test("/search by image concurrency limit", async () => {
    if (!fs.existsSync("32B15UXxymfSMwKGTObY5e.jpg")) {
      await fetch("https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg")
        .then((e) => e.arrayBuffer())
        .then((arrayBuffer) =>
          fs.outputFile("32B15UXxymfSMwKGTObY5e.jpg", Buffer.from(arrayBuffer)),
        );
    }
    const res = await Promise.all(
      [...new Array(5)].map((_) =>
        request(app).post("/search").attach("image", "32B15UXxymfSMwKGTObY5e.jpg"),
      ),
    );
    expect(res.map((e) => e.statusCode).includes(402)).toBe(true);
  });
});

describe("with API Key", () => {
  test("/search by image URL with API Key", async () => {
    const response = await request(app).get("/search").query({
      url: "https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg",
      key: app.locals.apiKeyTier1,
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

describe("with system Tier 9 API Key", () => {
  test("/search by image queue limit", async () => {
    if (!fs.existsSync("32B15UXxymfSMwKGTObY5e.jpg")) {
      await fetch("https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg")
        .then((e) => e.arrayBuffer())
        .then((arrayBuffer) =>
          fs.outputFile("32B15UXxymfSMwKGTObY5e.jpg", Buffer.from(arrayBuffer)),
        );
    }
    const res = await Promise.all(
      [...new Array(10)].map((_) =>
        request(app)
          .post("/search")
          .query({ key: app.locals.apiKeyTier9 })
          .attach("image", "32B15UXxymfSMwKGTObY5e.jpg"),
      ),
    );
    expect(res.map((e) => e.statusCode).includes(503)).toBe(true);
  });
});

describe("with system system API Key", () => {
  test("/search by image URL with API Key", async () => {
    const response = await request(app).get("/search").query({
      url: "https://images.plurk.com/32B15UXxymfSMwKGTObY5e.jpg",
      key: app.locals.apiKeyTier0,
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
    const response = await request(app).get("/search").query({ url: "https://0.0.0.0/a" });
    expect(response.statusCode).toBeGreaterThanOrEqual(400);
    expect(response.headers["content-type"]).toMatch(/^application\/json/);
    expect(typeof response.body.error).toBe("string");
  });
  test("/search by image URL with invalid image", async () => {
    // Failed to process image
    const response = await request(app).get("/search").query({ url: "https://api.trace.moe" });
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
