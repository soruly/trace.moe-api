import "dotenv/config";
import { createClient } from "redis";

const { REDIS_HOST, REDIS_PORT } = process.env;

const redis = createClient({
  url: `redis://${REDIS_HOST}:${REDIS_PORT}`,
});
await redis.connect();

const keys = await redis.keys("*");

console.table(
  await Promise.all(
    keys.filter((key) => key.startsWith("s:")).map((key) => Promise.all([key, redis.get(key)]))
  )
);

console.table(
  await Promise.all(
    keys.filter((key) => key.startsWith("rl:")).map((key) => Promise.all([key, redis.get(key)]))
  )
);
console.table(
  await Promise.all(
    keys.filter((key) => key.startsWith("q:")).map((key) => Promise.all([key, redis.get(key)]))
  )
);
console.table(
  await Promise.all(
    keys.filter((key) => key.startsWith("c:")).map((key) => Promise.all([key, redis.get(key)]))
  )
);
console.log(await redis.get("queue"));

const priority = 0;

const queueKeys = await redis.keys("q:*");
const higherPriorityKeys = queueKeys.filter((e) => Number(e.split(":")[1]) >= priority);
const higherPriorityQueues = higherPriorityKeys.length ? await redis.mGet(higherPriorityKeys) : [];
const higherPriorityQueuesLength = higherPriorityQueues
  .map((e) => Number(e))
  .reduce((a, b) => a + b, 0);
console.log(higherPriorityQueuesLength);
process.exit();
