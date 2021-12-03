import "dotenv/config";
import { default as request } from "supertest";
import app from "./app.js";

test("GET /", async () => {
  const response = await request(app).get("/");
  expect(response.statusCode).toBe(200);
});
