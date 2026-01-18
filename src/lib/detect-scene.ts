import sql from "../../sql.ts";

const { VIDEO_PATH } = process.env;

export default async (filePath, t, minDuration, maxDuration) => {
  if (t < 0) {
    return null;
  }

  const [file] = await sql`
    SELECT
      duration,
      scene_changes
    FROM
      files
    WHERE
      path = ${filePath.replace(VIDEO_PATH, "")}
    LIMIT
      1
  `;

  if (!file || file.duration <= 0 || t > file.duration) {
    return null;
  }

  if (file.scene_changes) {
    const boundaryList = [[0, 1], ...file.scene_changes, [file.duration, 1]];

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
      if (start <= t && t < end) {
        return {
          start: Math.max(0, t - start > maxDuration ? t - maxDuration : start),
          end: Math.min(end - t > maxDuration ? t + maxDuration : end, file.duration),
          duration: file.duration,
        };
      }
    }
  }

  // fallback to fixed scene cutting
  return {
    start: Math.max(0, t - minDuration),
    end: Math.min(t + minDuration, file.duration),
    duration: file.duration,
  };
};
