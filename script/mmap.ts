import { MilvusClient } from "@zilliz/milvus2-sdk-node";

import "../env.ts";

// https://milvus.io/docs/mmap.md

const { MILVUS_ADDR, MILVUS_TOKEN } = process.env;

const milvus = new MilvusClient({ address: MILVUS_ADDR, token: MILVUS_TOKEN });

if (process.argv.slice(2).includes("--enable")) {
  console.log("releasing collection");
  console.log(
    await milvus.releaseCollection({
      collection_name: "frame_color_layout",
    }),
  );
  console.log("enabling mmap");
  console.log(
    await milvus.alterCollectionProperties({
      collection_name: "frame_color_layout",
      properties: {
        "mmap.enabled": true,
      },
    }),
  );
  console.log("loading collection");
  console.log(
    await milvus.loadCollection({
      collection_name: "frame_color_layout",
    }),
  );
  console.log("completed");
} else if (process.argv.slice(2).includes("--disable")) {
  console.log("releasing collection");
  console.log(
    await milvus.releaseCollection({
      collection_name: "frame_color_layout",
    }),
  );
  console.log("disabling mmap");
  console.log(
    await milvus.alterCollectionProperties({
      collection_name: "frame_color_layout",
      properties: {
        "mmap.enabled": false,
      },
    }),
  );
  console.log("loading collection");
  console.log(
    await milvus.loadCollection({
      collection_name: "frame_color_layout",
    }),
  );
  console.log("completed");
} else {
  console.log("Usage: node mmap.ts [--enable|--disable]");
  console.log();
  console.log("Enable: (default) use less memory but slower query speed");
  console.log("Disable: store everything in memory for faster query speed");
  console.log();
  console.log(
    "Current setting:",
    (
      await milvus.describeCollection({
        collection_name: "frame_color_layout",
      })
    ).properties.find((prop) => prop.key === "mmap.enabled"),
  );
}

await milvus.closeConnection();
