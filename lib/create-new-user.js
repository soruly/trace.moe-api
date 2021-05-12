import path from "path";
import fs from "fs-extra";
import Knex from "knex";
import crypto from "crypto";
import { URL } from "url";
import child_process from "child_process";
import generateAPIKey from "./generate-api-key.js";

const {
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME,
  TRACE_API_SALT,
  GMAIL_API_USER,
  GMAIL_API_KEY,
} = process.env;

const __filename = new URL("", import.meta.url).pathname;
const __dirname = new URL(".", import.meta.url).pathname;

export default async (email, tier, dropExisting, full_name = "") => {
  const knex = Knex({
    client: "mysql",
    connection: {
      host: SOLA_DB_HOST,
      port: SOLA_DB_PORT,
      user: SOLA_DB_USER,
      password: SOLA_DB_PWD,
      database: SOLA_DB_NAME,
    },
  });

  if (!email) {
    console.log("Error: email cannot be empty");
    return;
  }
  const rows = await knex("tier").where("id", tier);
  if (!rows.length) {
    console.log("Error: invalid tier number");
    return;
  }
  if (dropExisting) {
    await knex("user").where("email", email).del();
  }
  const plainPassword = crypto
    .randomBytes(16)
    .toString("base64")
    .replace(/[^0-9a-zA-Z]/g, "");
  const autoIncrement = (
    await knex.raw(
      `SELECT AUTO_INCREMENT FROM information_schema.tables WHERE table_name = 'user' and table_schema = '${SOLA_DB_NAME}';`
    )
  )[0][0].AUTO_INCREMENT;
  await knex("user").insert({
    email,
    password: crypto.scryptSync(plainPassword, TRACE_API_SALT, 64).toString("base64"),
    api_key: generateAPIKey(autoIncrement),
    tier,
  });

  child_process.execSync(
    [
      `sendemail`,
      `-f "${GMAIL_API_USER}"`,
      `-t "${email}"`,
      `-u "Thank you for supporting trace.moe"`,
      `-s "smtp.gmail.com:587"`,
      `-o tls=yes`,
      `-xu "${GMAIL_API_USER}"`,
      `-xp "${GMAIL_API_KEY}"`,
      `-m '${fs
        .readFileSync(path.join(__dirname, "email.html"), "utf8")
        .replace("<!--user-->", full_name)
        .replace("<!--email-->", email)
        .replace("<!--password-->", plainPassword)}'`,
    ].join(" ")
  );
  knex.destroy();
};
