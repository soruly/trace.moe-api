import dns from "node:dns/promises";
import { isIP } from "node:net";

const PRIVATE_RANGES_V4 = [
  { start: 0x0a000000, end: 0x0affffff }, // 10.0.0.0/8
  { start: 0xac100000, end: 0xac1fffff }, // 172.16.0.0/12
  { start: 0xc0a80000, end: 0xc0a8ffff }, // 192.168.0.0/16
  { start: 0x7f000000, end: 0x7fffffff }, // 127.0.0.0/8
  { start: 0xa9fe0000, end: 0xa9feffff }, // 169.254.0.0/16
  { start: 0x00000000, end: 0x00ffffff }, // 0.0.0.0/8 (Current network)
];

function isPrivateIPv4(ip: string): boolean {
  const decimal = ip.split(".").reduce((acc, octet) => ((acc << 8) | parseInt(octet, 10)) >>> 0, 0);
  return PRIVATE_RANGES_V4.some((range) => decimal >= range.start && decimal <= range.end);
}

function isPrivateIPv6(ip: string): boolean {
  const lowerIP = ip.toLowerCase();
  if (lowerIP === "::1" || lowerIP === "::") return true;
  if (lowerIP.startsWith("fc") || lowerIP.startsWith("fd")) return true;
  if (
    lowerIP.startsWith("fe8") ||
    lowerIP.startsWith("fe9") ||
    lowerIP.startsWith("fea") ||
    lowerIP.startsWith("feb")
  )
    return true;

  if (lowerIP.startsWith("::ffff:")) {
    const ipv4Part = lowerIP.substring(7);
    if (isIP(ipv4Part) === 4) return isPrivateIPv4(ipv4Part);
  }

  return false;
}

async function isSafeURL(urlString: string): Promise<boolean> {
  try {
    const url = new URL(urlString);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;

    if (isIP(url.hostname) === 4) return !isPrivateIPv4(url.hostname);
    if (isIP(url.hostname) === 6) return !isPrivateIPv6(url.hostname);

    for (const { address, family } of await dns.lookup(url.hostname, { all: true })) {
      if (family === 4 && isPrivateIPv4(address)) return false;
      if (family === 6 && isPrivateIPv6(address)) return false;
    }

    return true;
  } catch (e) {
    return false;
  }
}

export default async function safeFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let currentURL = url;
  let redirects = 0;

  if (!(await isSafeURL(currentURL))) {
    throw new Error(`Unsafe URL: ${currentURL}`);
  }

  while (redirects < 5) {
    const response = await fetch(currentURL, { ...options, redirect: "manual" });

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
