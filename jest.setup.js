import "dotenv/config";
import fs from "fs-extra";
import Knex from "knex";

const { TRACE_ALGO, SOLA_DB_HOST, SOLA_DB_PORT, SOLA_DB_USER, SOLA_DB_PWD, SOLA_DB_NAME } =
  process.env;

export default async () => {
  console.log("Creating SQL database if not exist");
  const knex = Knex({
    client: "mysql",
    connection: {
      host: SOLA_DB_HOST,
      port: SOLA_DB_PORT,
      user: SOLA_DB_USER,
      password: SOLA_DB_PWD,
    },
  });
  await knex.raw(
    `CREATE DATABASE IF NOT EXISTS ${SOLA_DB_NAME} CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  );
  await knex.destroy();

  global.knex = Knex({
    client: "mysql",
    connection: {
      host: SOLA_DB_HOST,
      port: SOLA_DB_PORT,
      user: SOLA_DB_USER,
      password: SOLA_DB_PWD,
      database: SOLA_DB_NAME,
      multipleStatements: true,
    },
  });

  console.log("Creating SQL table if not exist");
  await global.knex.raw(
    fs.readFileSync("sql/structure.sql", "utf8").replace("TRACE_ALGO", TRACE_ALGO),
  );
  await global.knex.raw(fs.readFileSync("sql/data.sql", "utf8"));
};
