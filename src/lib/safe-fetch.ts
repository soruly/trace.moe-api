import dns from "node:dns";
import ipaddr from "ipaddr.js";
import { Agent, buildConnector, fetch as undiciFetch } from "undici";

function isPrivateIP(str: string): boolean {
  try {
    const addr = ipaddr.process(str);
    const range = addr.range();
    const unsafeRanges = [
      "loopback",
      "private",
      "uniqueLocal",
      "linkLocal",
      "unspecified",
      "carrierGradeNat",
      "reserved",
      "broadcast",
    ];
    return unsafeRanges.includes(range);
  } catch {
    return true;
  }
}

async function isSafeURL(urlString: string): Promise<boolean> {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;

    const hostname = url.hostname.replace(/^\[(.*)\]$/, "$1");

    if (ipaddr.isValid(hostname)) return !isPrivateIP(hostname);

    for (const { address } of await dns.promises.lookup(hostname, { all: true })) {
      if (isPrivateIP(address)) return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

const safeConnector = buildConnector({
  lookup: (hostname, options, callback) => {
    dns.lookup(hostname, options, (err, address, family) => {
      if (err) return callback(err, address, family);
      const addresses = Array.isArray(address) ? address : [{ address, family: family ?? 4 }];
      for (const entry of addresses) {
        if (isPrivateIP(entry.address)) {
          return callback(new Error(`Blocked private IP: ${entry.address}`), address, family);
        }
      }
      callback(null, address, family);
    });
  },
});

const safeDispatcher = new Agent({
  connect: (opts, cb) => {
    if (ipaddr.isValid(opts.hostname) && isPrivateIP(opts.hostname)) {
      return cb(new Error(`Blocked private IP: ${opts.hostname}`), null);
    }
    return safeConnector(opts, cb);
  },
});

export async function getBoundedBuffer(
  response: Response | any,
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
  options: any = {},
  timeoutMs = 10000,
): Promise<any> {
  let currentURL = url;
  let redirects = 0;

  const signal = options.signal
    ? AbortSignal.any([options.signal, AbortSignal.timeout(timeoutMs)])
    : AbortSignal.timeout(timeoutMs);

  if (!(await isSafeURL(currentURL))) {
    throw new Error(`Unsafe URL: ${currentURL}`);
  }

  while (redirects < 5) {
    const response = await undiciFetch(currentURL, {
      ...options,
      signal,
      dispatcher: safeDispatcher,
      redirect: "manual",
    });

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
