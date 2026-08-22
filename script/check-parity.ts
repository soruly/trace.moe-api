import child_process from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import zlib from "node:zlib";

import colorLayout from "../src/lib/color-layout.ts";

const zstdDecompress = promisify(zlib.zstdDecompress);
const exec = promisify(child_process.exec);

interface FrameData {
  time: number;
  vector: number[];
}

async function extractJsFallback(videoPath: string): Promise<FrameData[]> {
  return new Promise((resolve, reject) => {
    const VIDEO_WIDTH = 320;
    const VIDEO_HEIGHT = 180;
    const FRAME_SIZE = VIDEO_WIDTH * VIDEO_HEIGHT * 3;

    const frameData: FrameData[] = [];
    let stdoutBuffer = Buffer.alloc(0);
    const timeCodes: number[] = [];

    const processFrames = () => {
      while (stdoutBuffer.length >= FRAME_SIZE && timeCodes.length > 0) {
        const frameBuffer = stdoutBuffer.subarray(0, FRAME_SIZE);
        stdoutBuffer = stdoutBuffer.subarray(FRAME_SIZE);
        frameData.push({
          time: timeCodes.shift()!,
          vector: colorLayout(frameBuffer, VIDEO_WIDTH, VIDEO_HEIGHT),
        });
      }
    };

    const ffmpeg = child_process.spawn("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "info",
      "-nostats",
      "-i",
      videoPath,
      "-fps_mode",
      "passthrough",
      "-an",
      "-vf",
      `scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT},showinfo`,
      "-c:v",
      "rawvideo",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "-",
    ]);

    ffmpeg.stdout.on("data", (data: Buffer) => {
      stdoutBuffer = Buffer.concat([stdoutBuffer, data]);
      processFrames();
    });

    ffmpeg.stderr.on("data", (data: Buffer) => {
      const str = data.toString();
      let match;
      const timecodeRegex = /pts_time:\s*(\d+\.?\d*)/g;
      while ((match = timecodeRegex.exec(str))) {
        timeCodes.push(parseFloat(match[1]));
      }
      processFrames();
    });

    ffmpeg.on("close", (code) => {
      if (code === 0) resolve(frameData);
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });

    ffmpeg.on("error", reject);
  });
}

async function extractNative(videoPath: string): Promise<FrameData[]> {
  return new Promise((resolve, reject) => {
    const nativeBinaryPath = path.resolve(import.meta.dirname, "../trace-moe-colorlayout");
    if (!fs.existsSync(nativeBinaryPath)) {
      return reject(new Error(`Native binary not found at ${nativeBinaryPath}`));
    }

    const stdoutChunks: Buffer[] = [];
    const extractor = child_process.spawn(nativeBinaryPath, [videoPath]);

    extractor.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    extractor.on("close", async (code) => {
      if (code !== 0) {
        return reject(new Error(`Extractor exited with code ${code}`));
      }
      try {
        const compressed = Buffer.concat(stdoutChunks);
        const decompressed = await zstdDecompress(compressed);
        const json: FrameData[] = JSON.parse(decompressed.toString("utf8"));
        resolve(json);
      } catch (err) {
        reject(err);
      }
    });

    extractor.on("error", reject);
  });
}

async function main() {
  let testVideo = process.argv[2];
  let isTemp = false;

  if (!testVideo) {
    const rootSample = path.resolve(import.meta.dirname, "../sample.mkv");
    if (fs.existsSync(rootSample)) {
      testVideo = rootSample;
    } else {
      testVideo = path.resolve(import.meta.dirname, "sample.mkv");
    }
  }

  if (!fs.existsSync(testVideo)) {
    console.error(`Error: Sample video not found at: ${testVideo}`);
    console.error("Please provide a video path or place 'sample.mkv' in the project directory.");
    process.exit(1);
  }

  try {
    console.info(`\nRunning Parity Test on: ${testVideo}`);

    const t0_native = performance.now();
    const nativeResults = await extractNative(testVideo);
    const t1_native = performance.now();

    const t0_js = performance.now();
    const jsResults = await extractJsFallback(testVideo);
    const t1_js = performance.now();

    console.info(
      `Native Extractor: ${nativeResults.length} frames in ${(t1_native - t0_native).toFixed(2)}ms`,
    );
    console.info(`JS Fallback:      ${jsResults.length} frames in ${(t1_js - t0_js).toFixed(2)}ms`);
    console.info(
      `Speedup:          ${((t1_js - t0_js) / (t1_native - t0_native)).toFixed(2)}x faster\n`,
    );

    if (nativeResults.length !== jsResults.length) {
      console.error(`Frame count mismatch: Native=${nativeResults.length}, JS=${jsResults.length}`);
      process.exit(1);
    }

    let exactMatches = 0;
    let totalCoeffs = 0;
    let maxDiff = 0;
    let totalDiff = 0;

    for (let f = 0; f < nativeResults.length; f++) {
      const nFrame = nativeResults[f];
      const jFrame = jsResults[f];

      // Timecode diff
      const timeDiff = Math.abs(nFrame.time - jFrame.time);
      if (timeDiff > 0.01) {
        console.warn(`Frame ${f} timestamp diff: Native=${nFrame.time}, JS=${jFrame.time}`);
      }

      // Vector diff
      for (let i = 0; i < 33; i++) {
        totalCoeffs++;
        const nv = nFrame.vector[i];
        const jv = jFrame.vector[i];
        const diff = Math.abs(nv - jv);

        if (diff === 0) {
          exactMatches++;
        } else {
          if (diff > maxDiff) maxDiff = diff;
          totalDiff += diff;
        }
      }
    }

    const matchRate = (exactMatches / totalCoeffs) * 100;
    console.info("--- Parity Test Summary ---");
    console.info(`Total Frames Tested:    ${nativeResults.length}`);
    console.info(`Total Coefficients:     ${totalCoeffs}`);
    console.info(
      `Exact Matching Values:  ${exactMatches} / ${totalCoeffs} (${matchRate.toFixed(2)}%)`,
    );
    console.info(`Max Numerical Diff:     ${maxDiff}`);
    console.info(
      `Avg Diff (on mismatches): ${totalDiff > 0 ? (totalDiff / (totalCoeffs - exactMatches)).toFixed(4) : 0}`,
    );

    if (matchRate === 100) {
      console.info("\nSUCCESS: 100% Exact Parity between Native C and JS Fallback!");
    } else {
      console.info(`\nParity: ${matchRate.toFixed(2)}% matching coefficients.`);
    }
  } finally {
    if (isTemp && fs.existsSync(testVideo)) {
      fs.unlinkSync(testVideo);
    }
  }
}

main().catch((err) => {
  console.error("Parity test failed:", err);
  process.exit(1);
});
