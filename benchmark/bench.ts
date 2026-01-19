import { Worker } from "node:worker_threads";
import fs from "node:fs/promises";
import path from "node:path";

const ITERATIONS = 100;

async function runBench(name: string, workerFile: string, data?: any) {
  const start = performance.now();
  for (let i = 0; i < ITERATIONS; i++) {
    await new Promise<void>((resolve, reject) => {
      const worker = new Worker(workerFile, { workerData: data });
      worker.on("message", () => resolve());
      worker.on("error", reject);
      worker.on("exit", (code) => {
        if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
        resolve();
      });
    });
  }
  const end = performance.now();
  console.log(`${name}: ${(end - start).toFixed(2)}ms for ${ITERATIONS} iterations`);
}

async function main() {
  console.log("Running benchmark...");

  // Warmup ?

  // Baseline: Reading file in worker
  try {
    await runBench("ReadFile in Worker", path.join(import.meta.dirname, "./worker-read.ts"));
  } catch (e) {
    console.error("Baseline failed:", e);
  }

  // Optimization: Passing data
  const query = await fs.readFile(
    path.join(import.meta.dirname, "../script/anilist.graphql"),
    "utf8",
  );
  try {
    await runBench("Pass Data to Worker", path.join(import.meta.dirname, "./worker-pass.ts"), {
      query,
    });
  } catch (e) {
    console.error("Optimization failed:", e);
  }
}

main();
