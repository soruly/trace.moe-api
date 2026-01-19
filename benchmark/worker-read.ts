import fs from "node:fs/promises";
import path from "node:path";
import { parentPort } from "node:worker_threads";

async function run() {
  await fs.readFile(path.join(import.meta.dirname, "../script/anilist.graphql"), "utf8");
  if (parentPort) parentPort.postMessage("done");
}
run();
