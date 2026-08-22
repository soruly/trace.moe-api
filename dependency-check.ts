import { exec } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
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

  if (process.platform === "linux") {
    const nativeBinaryPath = path.resolve(import.meta.dirname, "trace-moe-colorlayout");
    if (!fs.existsSync(nativeBinaryPath)) {
      console.info("[dependency-check] Note: Native 'trace-moe-colorlayout' binary not found.");
      console.info("[dependency-check] Running in JavaScript fallback mode.");
      console.info(
        "[dependency-check] To enable high-performance native extraction, run 'make' after installing dev packages:",
      );
      console.info(
        "  - Fedora:        sudo dnf install gcc make pkgconf-pkg-config ffmpeg-devel libzstd-devel",
      );
      console.info("  - Arch Linux:    sudo pacman -S gcc make pkgconf ffmpeg zstd");
      console.info(
        "  - Debian/Ubuntu: sudo apt install gcc make pkg-config libavcodec-dev libavformat-dev libswscale-dev libavutil-dev libzstd-dev",
      );
      console.info();
    } else {
      console.info("[dependency-check] Native 'trace-moe-colorlayout' binary is available.");
    }
  }
}
