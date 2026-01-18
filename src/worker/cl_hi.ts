import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
import colorLayout from "../lib/color-layout.ts";

console.log(
  JSON.stringify(
    await Promise.all(
      (await fs.readdir(process.argv[2]))
        .filter((_, i) => i % Number(process.argv[4]) === Number(process.argv[3]))
        .map(async (file) => ({
          file,
          vector: await colorLayout(await sharp(path.join(process.argv[2], file)).toBuffer()),
        })),
    ),
  ),
);
