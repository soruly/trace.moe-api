import { performance } from "perf_hooks";

export function bench(name, func) {
  const benchStart = performance.now();
  const result = func();
  const benchEnd = performance.now();
  const benchTimeTaken = benchEnd - benchStart;
  console.log(`${name} done in ${benchTimeTaken.toFixed(3)} ms`);
  return result;
}

export async function benchAsync(name, func) {
  const benchStart = performance.now();
  const result = await func();
  const benchEnd = performance.now();
  const benchTimeTaken = benchEnd - benchStart;
  console.log(`${name} done in ${benchTimeTaken.toFixed(3)} ms`);
  return result;
}

