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
  await app.locals.knex("log").truncate();
  await app.locals.knex("log").insert({ time: new Date(), uid: "1", status: 200, search_time: 1 });
  await app.locals.knex("mediainfo").truncate();
  await app.locals.knex("mediainfo").insert({
    path: "/mnt/data/anilist/21034/Gochuumon wa Usagi Desuka 2 - 01 (BD 1280x720 x264 AAC).mp4",
    created: new Date(),
    updated: new Date(),
    json: '{\n    "streams": [\n        { "index": 0, "codec_name": "h264", "codec_long_name": "H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10", "profile": "Main", "codec_type": "video", "codec_tag_string": "avc1", "codec_tag": "0x31637661", "width": 1280, "height": 720, "coded_width": 1280, "coded_height": 720, "closed_captions": 0, "has_b_frames": 2, "sample_aspect_ratio": "1:1", "display_aspect_ratio": "16:9", "pix_fmt": "yuv420p", "level": 41, "chroma_location": "left", "refs": 1, "is_avc": "true", "nal_length_size": "4", "r_frame_rate": "24000/1001", "avg_frame_rate": "24000/1001", "time_base": "1/24000", "start_pts": 2002, "start_time": "0.083417", "duration_ts": 34031998, "duration": "1417.999917", "bit_rate": "1967814", "bits_per_raw_sample": "8", "nb_frames": "33998",\n            "disposition": { "default": 1, "dub": 0, "original": 0, "comment": 0, "lyrics": 0, "karaoke": 0, "forced": 0, "hearing_impaired": 0, "visual_impaired": 0, "clean_effects": 0, "attached_pic": 0, "timed_thumbnails": 0 },\n            "tags": { "creation_time": "2015-12-28T10:56:12.000000Z", "language": "und", "vendor_id": "[0][0][0][0]" } },\n        { "index": 1, "codec_name": "aac", "codec_long_name": "AAC (Advanced Audio Coding)", "profile": "LC", "codec_type": "audio", "codec_tag_string": "mp4a", "codec_tag": "0x6134706d", "sample_fmt": "fltp", "sample_rate": "48000", "channels": 2, "channel_layout": "stereo", "bits_per_sample": 0, "r_frame_rate": "0/0", "avg_frame_rate": "0/0", "time_base": "1/48000", "start_pts": 0, "start_time": "0.000000", "duration_ts": 68067328, "duration": "1418.069333", "bit_rate": "195324", "nb_frames": "66472",\n            "disposition": { "default": 1, "dub": 0, "original": 0, "comment": 0, "lyrics": 0, "karaoke": 0, "forced": 0, "hearing_impaired": 0, "visual_impaired": 0, "clean_effects": 0, "attached_pic": 0, "timed_thumbnails": 0 },\n            "tags": { "creation_time": "2015-12-28T10:50:34.000000Z", "language": "jpn", "vendor_id": "[0][0][0][0]" } }\n    ],\n    "format": { "filename": "/mnt/data/anilist/21034/Gochuumon wa Usagi Desuka 2 - 01 (BD 1280x720 x264 AAC).mp4", "nb_streams": 2, "nb_programs": 0, "format_name": "mov,mp4,m4a,3gp,3g2,mj2", "format_long_name": "QuickTime / MOV", "start_time": "0.000000", "duration": "1418.068333", "size": "384142354", "bit_rate": "2167130", "probe_score": 100,\n        "tags": { "major_brand": "isom", "minor_version": "1", "compatible_brands": "isomavc1", "creation_time": "2015-12-28T10:56:12.000000Z" } }\n}\n',
  });
});

afterAll(async () => {
  await app.locals.knex("log").truncate();
  await app.locals.knex("mediainfo").truncate();
  await app.locals.knex.destroy();
});

test("GET /stats", async () => {
  const response = await request(app).get("/stats");
  expect(response.statusCode).toBe(400);
  expect(response.headers["content-type"]).toMatch(/^application\/json/);
  expect(typeof response.body.error).toBe("string");
});

test("GET /stats?type=media", async () => {
  const response = await request(app).get("/stats").query({ type: "media" });
  expect(response.statusCode).toBe(200);
  expect(response.headers["content-type"]).toMatch(/^application\/json/);
  expect(typeof response.body.mediaCount).toBe("number");
  expect(typeof response.body.mediaFramesTotal).toBe("number");
  expect(typeof response.body.mediaDurationTotal).toBe("number");
  expect(typeof response.body.lastUpdate).toBe("string");
});

test("GET /stats?type=traffic", async () => {
  const response = await request(app).get("/stats").query({ type: "traffic" });
  expect(response.statusCode).toBe(400);
  expect(response.headers["content-type"]).toMatch(/^application\/json/);
  expect(typeof response.body.error).toBe("string");
});

test("GET /stats?type=traffic&period=hourly", async () => {
  const response = await request(app).get("/stats").query({ type: "traffic", period: "hourly" });
  expect(response.statusCode).toBe(200);
  expect(response.headers["content-type"]).toMatch(/^application\/json/);
  expect(Array.isArray(response.body)).toBeTruthy();
});

test("GET /stats?type=performance&period=hourly", async () => {
  const response = await request(app)
    .get("/stats")
    .query({ type: "performance", period: "hourly" });
  expect(response.statusCode).toBe(200);
  expect(response.headers["content-type"]).toMatch(/^application\/json/);
  expect(Array.isArray(response.body)).toBeTruthy();
});
