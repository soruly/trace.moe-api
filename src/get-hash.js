import path from "path";
import fs from "fs-extra";

const { HASH_PATH } = process.env;

export default async (req, res) => {
  const { anilistID, filename } = req.params;
  const hashFilePath = path.join(HASH_PATH, anilistID, filename);
  if (!hashFilePath.startsWith(HASH_PATH)) {
    res.status(403).send("403 Forbidden");
    return;
  }
  if (!fs.existsSync(hashFilePath)) {
    res.status(404).send("Not found");
    return;
  }
  res.send(fs.readFileSync(hashFilePath));
};
