import "dotenv/config";
import createNewUser from "../lib/create-new-user.js";

await createNewUser("soruly@gmail.com", 1, false, "soruly");
