import { parentPort, workerData } from "node:worker_threads";

async function run() {
  const data = workerData?.query;
  if (!data) throw new Error("No data");
  if (parentPort) parentPort.postMessage("done");
}
run();
