import postgres from "postgres";

process.loadEnvFile();
const { DB_NAME, DB_USER, DB_PASS, DB_HOST, DB_PORT } = process.env;

const sql = postgres({
  host: DB_HOST,
  port: DB_PORT,
  database: DB_NAME,
  username: DB_USER,
  password: DB_PASS,
});

export default sql;
