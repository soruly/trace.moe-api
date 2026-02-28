import assert from "node:assert";
import { test } from "node:test";

import colorLayout from "./color-layout.ts";

test("colorLayout determinism", () => {
  const width = 320;
  const height = 180;
  const buffer = Buffer.alloc(width * height * 3);
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] = i % 256;
  }

  const result = colorLayout(buffer, width, height);
  const expected = [
    30, 15, 16, 16, 16, 16, 16, 15, 16, 15, 16, 16, 16, 16, 15, 15, 15, 16, 15, 16, 15, 32, 16, 16,
    16, 16, 16, 32, 16, 16, 16, 16, 16,
  ];

  assert.deepStrictEqual(result, expected);
});

test("colorLayout consistency (repeated calls)", () => {
  const width = 320;
  const height = 180;
  const buffer = Buffer.alloc(width * height * 3);
  buffer.fill(128); // Grey image

  const result1 = colorLayout(buffer, width, height);
  const result2 = colorLayout(buffer, width, height);

  assert.deepStrictEqual(result1, result2);
});

test("colorLayout consistency (black image)", () => {
  const width = 320;
  const height = 180;
  const buffer = Buffer.alloc(width * height * 3);
  buffer.fill(0); // Black image

  const result = colorLayout(buffer, width, height);
  const expected = [
    2, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 32, 16, 16,
    16, 16, 16, 32, 16, 16, 16, 16, 16,
  ];

  assert.deepStrictEqual(result, expected);
});

test("colorLayout consistency (white image)", () => {
  const width = 320;
  const height = 180;
  const buffer = Buffer.alloc(width * height * 3);
  buffer.fill(255); // White image

  const result = colorLayout(buffer, width, height);
  const expected = [
    61, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 32, 16, 16,
    16, 16, 16, 32, 16, 16, 16, 16, 16,
  ];

  assert.deepStrictEqual(result, expected);
});
