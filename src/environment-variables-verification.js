const {
  VIDEO_PATH,
  HASH_PATH,
  TRACE_API_SALT,
  MILVUS_ADDR,
  MILVUS_TOKEN,
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASS,
  DB_NAME,
} = process.env;

export function verifyEnvironmentVariables() {
  if (!VIDEO_PATH || HASH_PATH.length === 0) {
    console.warn("`VIDEO_PATH` not set.");
    return false;
  }

  if (!HASH_PATH || HASH_PATH.length === 0) {
    console.warn("`VIDEO_PATH` not set.");
    return false;
  }

  if (!TRACE_API_SALT || TRACE_API_SALT === "YOUR_TRACE_API_SALT" || TRACE_API_SALT.length < 32) {
    console.warn("Please change `TRACE_API_SALT` to a random string of at least 32 characters.");
    return false;
  }

  if (!MILVUS_ADDR) {
    console.warn("`MILVUS_ADDR` not set.");
    return false;
  }

  if (!MILVUS_TOKEN) {
    console.warn("`MILVUS_TOKEN` not set.");
    return false;
  }

  if (!DB_HOST) {
    console.warn("`DB_HOST` not set.");
    return false;
  }

  if (!DB_PORT) {
    console.warn("`DB_PORT` not set.");
    return false;
  }

  if (!DB_USER) {
    console.warn("`DB_USER` not set.");
    return false;
  }

  if (!DB_PASS) {
    console.warn("`DB_PASS` not set.");
    return false;
  }

  if (!DB_NAME) {
    console.warn("`DB_NAME` not set.");
    return false;
  }

  return true;
}
