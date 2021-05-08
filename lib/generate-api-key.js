import crypto from "crypto";

export default (id) => {
  const b = crypto.randomBytes(32);
  b.writeUInt16LE(Number(id));
  return b.toString("base64").replace(/[^0-9a-zA-Z]/g, "");
};
