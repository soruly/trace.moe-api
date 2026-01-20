import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const wasmPath = path.join(import.meta.dirname, "../../build/color-layout.wasm");
const wasmBuffer = await fs.readFile(wasmPath);

const { instance } = await WebAssembly.instantiate(wasmBuffer, {
  env: {
    abort: (message: any, fileName: any, lineNumber: any, columnNumber: any) => {
      console.error(`Abort at ${fileName}:${lineNumber}:${columnNumber} -- ${message}`);
    },
  },
});

const exports = instance.exports as any;
const { getColorLayout, alloc, free, memory } = exports;

export default async (imageBuffer: Buffer) => {
  const input = await sharp(imageBuffer);
  const {
    data,
    info: { width, height },
  } = await input.raw().toBuffer({ resolveWithObject: true });

  const ptr = alloc(data.length);
  try {
    const memArray = new Uint8Array(memory.buffer);
    memArray.set(data, ptr);

    const resultPtr = getColorLayout(width, height, ptr);

    // result is 33 bytes. We create a view then convert to array.
    const resultView = new Uint8Array(memory.buffer, resultPtr, 33);
    return [...resultView];
  } finally {
    // Free input memory
    free(ptr);
  }
};
