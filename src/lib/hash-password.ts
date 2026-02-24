import { scrypt } from "node:crypto";
import { promisify } from "node:util";

const { TRACE_API_SALT } = process.env;

const scryptAsync = promisify(scrypt);

/**
 * Hashes a password using scrypt asynchronously to prevent event loop blocking.
 * @param password The password to hash.
 * @returns The base64 encoded hash.
 */
export default async (password: string): Promise<string> => {
  if (!TRACE_API_SALT) throw new Error("TRACE_API_SALT is not defined");
  return ((await scryptAsync(password, TRACE_API_SALT, 64)) as Buffer).toString("base64");
};
