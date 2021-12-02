import path from "path";
import fs from "fs-extra";
import crypto from "crypto";
import { URL } from "url";
import nodemailer from "nodemailer";
import generateAPIKey from "./generate-api-key.js";

const { SOLA_DB_NAME, TRACE_API_SALT, EMAIL_SMTP, EMAIL_SMTP_PORT, EMAIL_USER, EMAIL_PASS } =
  process.env;

const __filename = new URL("", import.meta.url).pathname;
const __dirname = new URL(".", import.meta.url).pathname;

export default async (knex, email, tier, full_name = "") => {
  if (!email) {
    return "Error: email cannot be empty";
  }
  if (!email.match(/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/)) {
    return "Error: invalid email address";
  }
  if (!tier) {
    return "Error: tier cannot be empty";
  }
  const rows = await knex("tier").where("id", tier);
  if (!rows.length) {
    return "Error: invalid tier number";
  }
  const users = await knex("user").where("email", email);
  if (users.length) {
    return "Error: user already exists";
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

  const transporter = nodemailer.createTransport({
    host: EMAIL_SMTP,
    port: Number(EMAIL_SMTP_PORT),
    secure: false,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  const info = await transporter.sendMail({
    from: `"trace.moe" <${EMAIL_USER}>`,
    to: email,
    bcc: EMAIL_USER,
    subject: "Thank you for supporting trace.moe",
    html: fs
      .readFileSync(path.join(__dirname, "email.html"), "utf8")
      .replace("<!--user-->", full_name)
      .replace("<!--email-->", email)
      .replace("<!--password-->", plainPassword),
  });

  console.log(info);
};
