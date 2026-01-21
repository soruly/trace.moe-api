import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";
import colorLayout from "../lib/color-layout.ts";

const dir = process.argv[2];
const threadId = Number(process.argv[3]);
const totalThreads = Number(process.argv[4]);

const files = await fs.readdir(dir);

for (let i = 0; i < files.length; i++) {
  if (i % totalThreads === threadId) {
    const file = files[i];
    const buffer = await sharp(path.join(dir, file)).toBuffer();
    const vector = await colorLayout(buffer);
    console.log(JSON.stringify({ file, vector }));
  }
}
