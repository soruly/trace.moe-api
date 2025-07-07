import getVideoDuration from "./get-video-duration.js";

const { VIDEO_PATH } = process.env;

export default async (filePath, t, minDuration, maxDuration, knex) => {
  if (t < 0) {
    return null;
  }

  const videoDuration = await getVideoDuration(filePath, knex);
  if (videoDuration === null || t > videoDuration) {
    return null;
  }

  const rows = await knex("file")
    .where("path", filePath.replace(VIDEO_PATH, ""))
    .select("scene")
    .first();

  if (rows?.scene) {
    const boundaryList = [[0, 1], ...JSON.parse(rows.scene), [videoDuration, 1]];

    // merge scenes shorter than minDuration
    let prevThreshold = Infinity;
    do {
      const threshold = boundaryList
        .filter((e) => e[1] < prevThreshold)
        .reduce((acc, cur) => Math.max(acc, cur[1]), 0);
      prevThreshold = threshold;
      for (let i = 0; i < boundaryList.length; i++) {
        if (boundaryList[i][1] === threshold) {
          // find boundary -1sec ~ +1sec and eliminate them
          let k = i - 1;
          while (k >= 0) {
            if (boundaryList[i][0] - boundaryList[k][0] < minDuration) {
              boundaryList.splice(k, 1);
              k--;
              i--; // array index also shifted
            } else break;
          }
          k = i + 1;
          while (k <= boundaryList.length - 1) {
            if (boundaryList[k][0] - boundaryList[i][0] < minDuration) {
              boundaryList.splice(k, 1);
            } else break;
          }
        }
      }
    } while (boundaryList.some((e) => e[1] < prevThreshold));

    const sceneList = boundaryList.reduce((acc, cur, i, arr) => {
      if (i === arr.length - 1) return acc;
      else acc.push([cur[0], arr[i + 1][0]]);
      return acc;
    }, []);

    for (const [start, end] of sceneList) {
      if (start <= t && t <= end) {
        return {
          start: Math.max(0, t - start > maxDuration ? t - maxDuration : start),
          end: Math.min(end - t > maxDuration ? t + maxDuration : end, videoDuration),
          duration: videoDuration,
        };
      }
    }
  }

  // fallback to fixed scene cutting
  return {
    start: Math.max(0, t - minDuration),
    end: Math.min(t + minDuration, videoDuration),
    duration: videoDuration,
  };
};
