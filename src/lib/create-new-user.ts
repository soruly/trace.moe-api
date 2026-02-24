import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { URL } from "node:url";
import nodemailer from "nodemailer";
import sql from "../../sql.ts";
import generateAPIKey from "./generate-api-key.ts";
import hashPassword from "./hash-password.ts";

const { EMAIL_SMTP, EMAIL_SMTP_PORT } = process.env;
let { EMAIL_USER, EMAIL_PASS, EMAIL_FROM } = process.env;

const __filename = new URL("", import.meta.url).pathname;
const __dirname = new URL(".", import.meta.url).pathname;

const escapeHtml = (unsafe: string) => {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export default async (email, tier, full_name = "") => {
  if (!email) {
    return "Error: email cannot be empty";
  }
  if (!email.match(/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/)) {
    return "Error: invalid email address";
  }
  if (!tier) {
    return "Error: tier cannot be empty";
  }
  const rows = await sql`
    SELECT
      *
    FROM
      tiers
    WHERE
      id = ${tier}
  `;
  if (!rows.length) {
    return "Error: invalid tier number";
  }
  const users = await sql`
    SELECT
      *
    FROM
      users
    WHERE
      email = ${email}
  `;
  if (users.length) {
    return "Error: user already exists";
  }

  const plainPassword = crypto
    .randomBytes(16)
    .toString("base64")
    .replace(/[^0-9a-zA-Z]/g, "");
  const [{ id }] = await sql`
    INSERT INTO
      users (tier, email, password, api_key)
    VALUES
      (
        ${tier},
        ${email},
        ${await hashPassword(plainPassword)},
        ${generateAPIKey(0)}
      )
    RETURNING
      id
  `;
  await sql`
    UPDATE users
    SET
      api_key = ${generateAPIKey(id)}
    WHERE
      id = ${id}
  `;

  if (EMAIL_SMTP === "smtp.ethereal.email") {
    const account = await nodemailer.createTestAccount();
    EMAIL_USER = account.user;
    EMAIL_PASS = account.pass;
  }

  if (!EMAIL_SMTP || !EMAIL_SMTP_PORT || !EMAIL_USER || !EMAIL_PASS || !EMAIL_FROM) return;
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
    from: `"trace.moe" <${EMAIL_FROM}>`,
    to: email,
    bcc: EMAIL_USER,
    subject: "Thank you for supporting trace.moe",
    html: (await fs.readFile(path.join(__dirname, "email.html"), "utf8"))
      .replace("<!--user-->", escapeHtml(full_name))
      .replace("<!--email-->", escapeHtml(email))
      .replace("<!--password-->", escapeHtml(plainPassword)),
  });
};
