import dns from "node:dns/promises";
import ipaddr from "ipaddr.js";

function isPrivateIP(str: string) {
  try {
    const addr = ipaddr.parse(str);
    return (
      addr.range() === "loopback" || addr.range() === "private" || addr.range() === "linkLocal"
    );
  } catch (error) {
    return false;
  }
}

async function isSafeURL(urlString: string): Promise<boolean> {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;

    const hostname = url.hostname.replace(/^\[(.*)\]$/, "$1");

    if (ipaddr.isValid(hostname)) return !isPrivateIP(hostname);

    for (const { address } of await dns.lookup(hostname, { all: true })) {
      if (isPrivateIP(address)) return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

export async function getBoundedBuffer(
  response: Response,
  maxBytes = 25 * 1024 * 1024,
): Promise<Buffer> {
  const contentLength = Number(response.headers.get("content-length"));
  if (contentLength && contentLength > maxBytes) {
    throw new Error(`Response size (${contentLength} bytes) exceeds limit of ${maxBytes} bytes`);
  }

  if (!response.body) {
    return Buffer.alloc(0);
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.length;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new Error(`Response body exceeds maximum allowed size of ${maxBytes} bytes`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, totalBytes);
}

export default async function safeFetch(
  url: string,
  options: RequestInit = {},
  timeoutMs = 10000,
): Promise<Response> {
  let currentURL = url;
  let redirects = 0;

  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)])
    : AbortSignal.timeout(timeoutMs);

  if (!(await isSafeURL(currentURL))) {
    throw new Error(`Unsafe URL: ${currentURL}`);
  }

  while (redirects < 5) {
    const response = await fetch(currentURL, { ...options, signal, redirect: "manual" });

    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      redirects++;
      const location = response.headers.get("location");
      if (!location) break;

      try {
        currentURL = new URL(location, currentURL).toString();
      } catch (e) {
        throw new Error(`Invalid redirect URL: ${location}`);
      }

      if (!(await isSafeURL(currentURL))) {
        throw new Error(`Unsafe redirect URL: ${currentURL}`);
      }
      continue;
    }

    return response;
  }

  throw new Error("Too many redirects");
}
