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
  return ffmpegInstalled && ffprobeInstalled;
}

{
  const isFFmpegInstalled = await checkFfmpegTools();
  if (!isFFmpegInstalled) {
    console.error();
    console.error("FFmpeg is not installed or is not available in your PATH.");
    console.error("This application requires FFmpeg and FFprobe to process media files.");
    console.error();
    console.error(
      "Install FFmpeg and ensure both 'ffmpeg' and 'ffprobe' are accessible from your terminal.",
    );
    process.exit(1);
  }
}
