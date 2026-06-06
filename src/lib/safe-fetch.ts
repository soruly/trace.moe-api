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
