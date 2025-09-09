import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

const { HASH_PATH } = process.env;

export function getFilePath(filePath) {
  return `${path.join(HASH_PATH, filePath)}.json.zst`;
}

export async function read(filePath) {
  const hashFilePath = getFilePath(filePath);
  await fs.access(hashFilePath);
  let hashList = JSON.parse(zlib.zstdDecompressSync(await fs.readFile(hashFilePath)));
  hashList = hashList.sort((a, b) => a.time - b.time);
  return hashList;
}

export async function write(filePath, hashList) {
  const hashFilePath = getFilePath(filePath);
  await fs.mkdir(path.dirname(hashFilePath), { recursive: true });
  await fs.writeFile(
    hashFilePath,
    zlib.zstdCompressSync(JSON.stringify(hashList), {
      params: { [zlib.constants.ZSTD_c_compressionLevel]: 19 },
    }),
  );
}
