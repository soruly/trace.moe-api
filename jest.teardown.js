import "dotenv/config";

const { SOLA_DB_NAME } = process.env;

export default async () => {
  console.log("Drop test SQL database");
  await global.knex.raw(`DROP DATABASE IF EXISTS ${SOLA_DB_NAME};`);
  await global.knex.destroy();
};
