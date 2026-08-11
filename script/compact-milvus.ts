import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import "../env.ts";

const { MILVUS_ADDR, MILVUS_TOKEN } = process.env;

const milvus = new MilvusClient({ address: MILVUS_ADDR, token: MILVUS_TOKEN });

console.log("Triggering compaction for frame_color_layout...");
const res = await milvus.compact({
  collection_name: "frame_color_layout",
});

console.log("Compaction initiated:", res);

if (res.compactionID) {
  const state = await milvus.getCompactionState({
    compactionID: res.compactionID,
  });
  console.log("Compaction state:", state);
}

await milvus.closeConnection();
