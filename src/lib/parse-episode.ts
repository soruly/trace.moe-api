export function parseEpisodeRange(ep: unknown): {
  episode_start: number | null;
  episode_end: number | null;
} {
  if (ep == null) {
    return { episode_start: null, episode_end: null };
  }

  if (typeof ep === "number") {
    if (Number.isNaN(ep)) return { episode_start: null, episode_end: null };
    const intVal = Math.round(ep);
    return { episode_start: intVal, episode_end: intVal };
  }

  if (Array.isArray(ep)) {
    const numbers = ep
      .map((item) => Number(item))
      .filter((num) => !Number.isNaN(num) && Number.isFinite(num))
      .map((num) => Math.round(num));

    if (numbers.length === 0) {
      return { episode_start: null, episode_end: null };
    }
    return {
      episode_start: Math.min(...numbers),
      episode_end: Math.max(...numbers),
    };
  }

  const str = String(ep).trim();
  if (!str) {
    return { episode_start: null, episode_end: null };
  }

  if (/^\d+$/.test(str)) {
    const val = parseInt(str, 10);
    return { episode_start: val, episode_end: val };
  }

  const rangeMatch = str.match(/^(\d+)\s*[-~_]\s*(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    return {
      episode_start: Math.min(start, end),
      episode_end: Math.max(start, end),
    };
  }

  const allNums = (str.match(/\d+/g) || [])
    .map((x) => parseInt(x, 10))
    .filter((x) => !Number.isNaN(x));

  if (allNums.length > 0) {
    return {
      episode_start: Math.min(...allNums),
      episode_end: Math.max(...allNums),
    };
  }

  return { episode_start: null, episode_end: null };
}
