import crypto from "node:crypto";

export default (id: number) => {
  const b = crypto.randomBytes(32);
  b.writeUInt16LE(Number(id));
  return b.toString("base64").replace(/[^0-9a-zA-Z]/g, "");
};
