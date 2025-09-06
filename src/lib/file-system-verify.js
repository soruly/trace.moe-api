import fs from "node:fs/promises";

export async function verifyAndCreateDirectoryIfNotExists(variableName, directoryPath) {
  try {
    const videoPathStats = await fs.stat(directoryPath);
    if (!videoPathStats.isDirectory()) {
      throw new Error(`${variableName} is not pointing to a directory!`);
    }
  } catch (err) {
    if (err.code === "ENOENT") {
      console.log(`${variableName} does not exist, creating directory: ${directoryPath}`);
      await fs.mkdir(directoryPath, { recursive: true });
    } else {
      throw err;
    }
  }
}
