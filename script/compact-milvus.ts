import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import "../env.ts";

const { MILVUS_ADDR, MILVUS_TOKEN } = process.env;

const milvus = new MilvusClient({ address: MILVUS_ADDR, token: MILVUS_TOKEN });

const res = await milvus.compact({
  collection_name: "frame_color_layout",
});

if (res?.status?.error_code && res.status.error_code !== "Success") {
  console.error("Failed to initiate compaction:", res.status.reason || res.status.error_code);
} else {
  console.log("Compaction initiated:", res);

  if (res.compactionID) {
    const state = await milvus.getCompactionState({
      compactionID: res.compactionID,
    });
    console.log("Compaction state:", state);
  }
}

await milvus.closeConnection();
