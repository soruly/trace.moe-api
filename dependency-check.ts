import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

async function checkBinary(command: string): Promise<boolean> {
  try {
    await execAsync(`${command} -version`);
    return true;
  } catch {
    return false;
  }
}

async function checkFfmpegTools(): Promise<boolean> {
  const ffmpegInstalled = await checkBinary("ffmpeg");
  const ffprobeInstalled = await checkBinary("ffprobe");

  console.log("Checking FFmpeg tools...");
  console.log("FFmpeg:", ffmpegInstalled ? "found" : "not found");
  console.log("FFprobe:", ffprobeInstalled ? "found" : "not found");

  return ffmpegInstalled && ffprobeInstalled;
}

{
  const hasRequiredTools = await checkFfmpegTools();
  if (!hasRequiredTools) {
    console.warn();
    console.warn("Missing required dependencies.");
    process.exit(1);
  }
}
