import util from "util";
import * as redis from "redis";

const client = redis.createClient();
const keysAsync = util.promisify(client.keys).bind(client);
const getAsync = util.promisify(client.get).bind(client);
const mgetAsync = util.promisify(client.mget).bind(client);

const keys = await keysAsync("*");

console.table(
  await Promise.all(
    keys.filter((key) => key.startsWith("s:")).map((key) => Promise.all([key, getAsync(key)]))
  )
);

console.table(
  await Promise.all(
    keys.filter((key) => key.startsWith("rl:")).map((key) => Promise.all([key, getAsync(key)]))
  )
);
console.table(
  await Promise.all(
    keys.filter((key) => key.startsWith("q:")).map((key) => Promise.all([key, getAsync(key)]))
  )
);
console.table(
  await Promise.all(
    keys.filter((key) => key.startsWith("c:")).map((key) => Promise.all([key, getAsync(key)]))
  )
);
console.log(await getAsync("queue"));

const priority = 0;

const queueKeys = await keysAsync("q:*");
const higherPriorityKeys = queueKeys.filter((e) => Number(e.split(":")[1]) >= priority);
const higherPriorityQueues = higherPriorityKeys.length ? await mgetAsync(higherPriorityKeys) : [];
const higherPriorityQueuesLength = higherPriorityQueues
  .map((e) => Number(e))
  .reduce((a, b) => a + b, 0);
console.log(higherPriorityQueuesLength);
process.exit();
