import child_process from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";

sharp.cache(false); // disable libvips in-memory cache
sharp.concurrency(1); // reduce threadpool arena allocation

function getVideoFrameRect(
  data: Buffer,
  width: number,
  height: number,
  channels = 3,
  colorTolerance = 10,
) {
  function isDark(x: number, y: number) {
    const i = (y * width + x) * channels;
    return (
      data[i] <= colorTolerance && data[i + 1] <= colorTolerance && data[i + 2] <= colorTolerance
    );
  }

  function isRowDark(y: number) {
    let darkPixelCount = 0;
    for (let x = 0; x < width; x++) {
      if (isDark(x, y)) darkPixelCount++;
    }
    return darkPixelCount > width * 0.95;
  }

  function isColDark(x: number) {
    let darkPixelCount = 0;
    for (let y = 0; y < height; y++) {
      if (isDark(x, y)) darkPixelCount++;
    }
    return darkPixelCount > height * 0.95;
  }

  let top: number, bottom: number, left: number, right: number;

  const centerY = Math.floor(height / 2);
  const centerX = Math.floor(width / 2);

  if (!isDark(centerX, centerY)) {
    top = centerY;
    bottom = centerY;
    left = centerX;
    right = centerX;
    while (top > 0 && !isRowDark(top - 1)) top--;
    while (bottom < height - 1 && !isRowDark(bottom + 1)) bottom++;
    while (left > 0 && !isColDark(left - 1)) left--;
    while (right < width - 1 && !isColDark(right + 1)) right++;
  } else {
    top = 0;
    bottom = height - 1;
    left = 0;
    right = width - 1;
    while (top < height && isRowDark(top)) top++;
    while (bottom > top && isRowDark(bottom)) bottom--;
    while (left < width && isColDark(left)) left++;
    while (right > left && isColDark(right)) right--;
  }

  return {
    x: left,
    y: top,
    width: Math.max(1, right - left + 1),
    height: Math.max(1, bottom - top + 1),
  };
}

function getNearestAspectRatio(
  width: number,
  height: number,
  targetAspectRatios: number[],
  threshold = 0.05,
) {
  const aspectRatio = width / height;
  let bestRatio = null;
  let minDiff = Infinity;

  for (const targetRatio of targetAspectRatios) {
    const diff = Math.abs(aspectRatio - targetRatio);
    if (diff < minDiff) {
      minDiff = diff;
      bestRatio = targetRatio;
    }
  }

  if (minDiff <= threshold) {
    return bestRatio;
  }
  return null;
}

function snapRectToNearestAspectRatio(
  rect: { x: number; y: number; width: number; height: number },
  maxW: number,
  maxH: number,
) {
  const targetRatios = [4 / 3, 16 / 9, 21 / 9];
  const currentRatio = rect.width / (rect.height || 1);
  let R = targetRatios[0];
  let minDiff = Math.abs(currentRatio - R);
  for (let i = 1; i < targetRatios.length; i++) {
    const diff = Math.abs(currentRatio - targetRatios[i]);
    if (diff < minDiff) {
      minDiff = diff;
      R = targetRatios[i];
    }
  }

  let w = rect.width;
  let h = rect.height;
  if (w / R > h) {
    w = h * R;
  } else {
    h = w / R;
  }

  if (w < 10) w = 10;
  if (h < 10) h = 10;

  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  let x = cx - w / 2;
  let y = cy - h / 2;

  if (x < 0) x = 0;
  if (y < 0) y = 0;
  if (x + w > maxW) {
    x = maxW - w;
    if (x < 0) {
      x = 0;
      w = maxW;
    }
  }
  if (y + h > maxH) {
    y = maxH - h;
    if (y < 0) {
      y = 0;
      h = maxH;
    }
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(w),
    height: Math.round(h),
  };
}

const resizeAndCropImage = async (imageBuffer: Buffer, cutBorders: boolean): Promise<any> => {
  const resizedImage = await sharp(imageBuffer)
    .resize({ width: 320, height: 320, fit: "inside" })
    .toBuffer();
  let croppedImage = sharp(resizedImage);

  if (cutBorders) {
    try {
      const { data, info } = await sharp(resizedImage)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const targetRatios = [4 / 3, 16 / 9, 21 / 9];
      const matchedRatio = getNearestAspectRatio(info.width, info.height, targetRatios);
      if (matchedRatio === null) {
        const detected = getVideoFrameRect(data, info.width, info.height, 3, 10);
        const snapped = snapRectToNearestAspectRatio(detected, info.width, info.height);
        croppedImage = sharp(resizedImage).extract({
          left: snapped.x,
          top: snapped.y,
          width: snapped.width,
          height: snapped.height,
        });
      }
    } catch {
      croppedImage = sharp(resizedImage);
    }
  }

  return croppedImage
    .flatten({ background: "#000000" })
    .raw()
    .toBuffer({ resolveWithObject: true });
};

const extractImageByFFmpeg = async (searchFile: Buffer): Promise<Buffer> => {
  // must use file input because input file buffer may be unseekable
  // ffmpeg cannot determine the video format for such stream
  const tempFilePath = path.join(os.tmpdir(), `trace.moe-search-${process.hrtime().join("")}`);
  await fs.writeFile(tempFilePath, searchFile);
  return new Promise((resolve) => {
    const ffmpeg = child_process.spawn("ffmpeg", [
      "-hide_banner",
      "-loglevel",
      "error",
      "-nostats",
      "-y",
      "-i",
      tempFilePath,
      "-ss",
      "00:00:00",
      "-map_metadata",
      "-1",
      "-vf",
      "scale=320:-2",
      "-c:v",
      "png",
      "-vframes",
      "1",
      "-f",
      "image2pipe",
      "pipe:1",
    ]);
    ffmpeg.stderr.on("data", (data) => {
      console.log(data.toString());
    });
    const chunks = [];
    ffmpeg.stdout.on("data", (data) => {
      chunks.push(data);
    });
    ffmpeg.on("close", (code) => {
      if (code !== 0) chunks.push(Buffer.alloc(0));
      resolve(Buffer.concat(chunks));
      fs.rm(tempFilePath, { force: true }).catch(() => {});
    });
  });
};

export default async (searchFile: Buffer, cutBorders: boolean): Promise<any> => {
  try {
    return await resizeAndCropImage(searchFile, cutBorders);
  } catch (e) {
    console.log(e);
    const extractedImage = await extractImageByFFmpeg(searchFile);
    if (!extractedImage.length) return null;
    try {
      return await resizeAndCropImage(extractedImage, cutBorders);
    } catch (e) {
      return null;
    }
  }
};
