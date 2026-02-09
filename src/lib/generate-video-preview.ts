import child_process from "node:child_process";

const generateVideoPreview = (
  filePath: string,
  start: number,
  end: number,
  size: string = "m",
  mute: boolean = false,
  outputFile?: string,
) => {
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostats",
    "-y",
    "-ss",
    String(start - 10),
    "-i",
    filePath,
    "-ss",
    "10",
    "-t",
    String(end - start),
    mute ? "-an" : "-y",
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-vf",
    `scale=${{ l: 640, m: 320, s: 160 }[size]}:-2`,
    "-c:v",
    "libx264",
    "-crf",
    "25",
    "-profile:v",
    "high",
    "-preset",
    "veryfast",
    "-bf",
    "8",
    "-r",
    "24000/1001",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-ac",
    "2",
    "-b:a",
    "64k",
    "-max_muxing_queue_size",
    "1024",
    "-movflags",
    "empty_moov+faststart",
    "-map_metadata",
    "-1",
    "-map_chapters",
    "-1",
    "-f",
    "mp4",
    outputFile || "-",
  ];

  const ffmpeg = child_process.spawn("ffmpeg", args, { timeout: 10000 });

  ffmpeg.stderr.on("data", (data) => {
    console.log(data.toString());
  });
  return ffmpeg;
};

export default generateVideoPreview;
