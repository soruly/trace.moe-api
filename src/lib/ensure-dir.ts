import fs from "node:fs/promises";

export async function ensureDir(directoryPath) {
  try {
    const videoPathStats = await fs.stat(directoryPath);
    if (!videoPathStats.isDirectory()) {
      throw new Error(`${directoryPath} is not a directory`);
    }
  } catch (err) {
    if (err.code === "ENOENT") {
      console.log(`Creating directory: ${directoryPath}`);
      await fs.mkdir(directoryPath, { recursive: true });
    } else {
      throw err;
    }
  }
}
