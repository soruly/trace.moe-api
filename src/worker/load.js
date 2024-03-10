import path from "node:path";
import xmldoc from "xmldoc";
import fs from "fs-extra";
import { parentPort, threadId, workerData } from "node:worker_threads";
import lzma from "lzma-native";

const { HASH_PATH, DISCORD_URL, TELEGRAM_ID, TELEGRAM_URL } = process.env;

const { filePath, coreUrl } = workerData;
parentPort.postMessage(`[${threadId}] Loading ${filePath}`);

const hashFilePath = `${path.join(HASH_PATH, filePath)}.xml.xz`;
if (!fs.existsSync(hashFilePath)) {
  parentPort.postMessage(`[${threadId}] Error: No such file ${hashFilePath}`);
  process.exit(1);
}

parentPort.postMessage(`[${threadId}] Decompressing ${hashFilePath}`);
const xmlData = await lzma.decompress(await fs.readFile(hashFilePath));

parentPort.postMessage(`[${threadId}] Parsing xml`);
const hashList = new xmldoc.XmlDocument(xmlData).children
  .filter((child) => child.name === "doc")
  .map((doc) => {
    const fields = doc.children.filter((child) => child.name === "field");
    return {
      time: parseFloat(fields.filter((field) => field.attr.name === "id")[0].val),
      cl_hi: fields.filter((field) => field.attr.name === "cl_hi")[0].val,
      cl_ha: fields.filter((field) => field.attr.name === "cl_ha")[0].val,
    };
  })
  .sort((a, b) => a.time - b.time);

const dedupedHashList = [];
hashList.forEach((currentFrame) => {
  if (
    !dedupedHashList
      .slice(-24) // get last 24 frames
      .filter((frame) => currentFrame.time - frame.time < 2) // select only frames within 2 sec
      .some((frame) => frame.cl_hi === currentFrame.cl_hi) // check for exact match frames
  ) {
    dedupedHashList.push(currentFrame);
  }
});

const xml = [
  "<add>",
  dedupedHashList
    .map((doc) =>
      [
        "<doc>",
        '<field name="id">',
        `<![CDATA[${filePath}/${doc.time.toFixed(2)}]]>`,
        "</field>",
        '<field name="cl_hi">',
        doc.cl_hi,
        "</field>",
        '<field name="cl_ha">',
        doc.cl_ha,
        "</field>",
        "</doc>",
      ].join(""),
    )
    .join("\n"),
  "</add>",
].join("\n");

await new Promise((resolve) => setTimeout(resolve, 500));
parentPort.postMessage(`[${threadId}] Uploading xml to ${coreUrl}`);
await fetch(`${coreUrl}/update?wt=json&commit=true`, {
  method: "POST",
  headers: { "Content-Type": "text/xml" },
  body: xml,
});

parentPort.postMessage(`[${threadId}] Loaded ${filePath}`);

if (TELEGRAM_ID && TELEGRAM_URL) {
  fetch(TELEGRAM_URL, {
    method: "POST",
    body: new URLSearchParams([
      ["chat_id", TELEGRAM_ID],
      ["parse_mode", "Markdown"],
      ["text", "`" + path.basename(filePath) + "`"],
    ]),
  });
}

if (DISCORD_URL) {
  fetch(DISCORD_URL, {
    method: "POST",
    body: new URLSearchParams([["content", path.basename(filePath)]]),
  });
}
