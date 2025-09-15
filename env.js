process.loadEnvFile();
if (
  [
    "VIDEO_PATH",
    "TRACE_API_SALT",
    "MILVUS_ADDR",
    "MILVUS_TOKEN",
    "DB_HOST",
    "DB_PORT",
    "DB_USER",
    "DB_PASS",
    "DB_NAME",
  ]
    .filter((envVar) => !process.env[envVar])
    .map((envVar) => {
      console.warn(`${envVar} is not set`);
      return envVar;
    }).length
) {
  console.warn("Missing required environment variables");
  process.exit(1);
}
