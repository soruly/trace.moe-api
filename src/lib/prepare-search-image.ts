import child_process from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import sharp from "sharp";

const resizeAndCropImage = async (imageBuffer: Buffer, cutBorders: boolean): Promise<any> => {
  let resizedImage = sharp(imageBuffer).resize({ width: 320, height: 320, fit: "inside" });
  let croppedImage = resizedImage;
  if (cutBorders) {
    // normalize brightness -> blur away UI controls -> trim with certain dark threshold
    const { info } = await resizedImage
      .normalize()
      .dilate(2)
      .trim({ background: "black", threshold: 30 })
      .toBuffer({ resolveWithObject: true });

    const trimmedTop = Math.abs(info.trimOffsetTop);
    const trimmedLeft = Math.abs(info.trimOffsetLeft);
    const newWidth = info.width;
    const newHeight = info.height;
    if (
      Math.abs(newWidth / newHeight - 16 / 9) < 0.05 ||
      Math.abs(newWidth / newHeight - 4 / 3) < 0.05
    ) {
      // if detected area is near 16:9 or 4:3, crop as detected
      croppedImage = resizedImage.extract({
        left: trimmedLeft,
        top: trimmedTop,
        width: newWidth,
        height: newHeight,
      });
    } else if (Math.abs(newWidth / newHeight - 21 / 9) < 0.1) {
      // if detected area is near 21:9
      const { width, height } = await sharp(imageBuffer).metadata();
      if ((width - newWidth) / width > 0.05 || (height - newHeight) / height > 0.05) {
        // and detected area is smaller than original, crop and fill it back to 16:9
        croppedImage = resizedImage
          .extract({
            left: trimmedLeft,
            top: trimmedTop,
            width: newWidth,
            height: newHeight,
          })
          .resize({ width: 320, height: 180, fit: "contain" });
      }
    }
    // if detected area is not standard aspect ratio, do no crop
    // if detected area is 21:9 and original is also 21:9, do no crop
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
    const extractedImage = await extractImageByFFmpeg(searchFile);
    if (!extractedImage.length) return null;
    try {
      return await resizeAndCropImage(extractedImage, cutBorders);
    } catch (e) {
      return null;
    }
  }
};
