import * as redis from "redis";
import Knex from "knex";
import util from "util";

const client = redis.createClient();
const getAsync = util.promisify(client.get).bind(client);
const ttlAsync = util.promisify(client.ttl).bind(client);

const { SOLA_DB_HOST, SOLA_DB_PORT, SOLA_DB_USER, SOLA_DB_PWD, SOLA_DB_NAME } = process.env;

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

export default async (req, res) => {
  let user = {
    user_id: null,
    user_email: req.ip,
    user_limit: 10,
    user_limit_ttl: 60,
  };

  if (req.query.token) {
    const result = await knex("users")
      .select("user_id", "email", "user_limit", "user_limit_ttl")
      .where("api_key", req.query.token);

    if (result.length === 0) {
      res.status(403).send(`"error: invalid token"`);
      return;
    } else {
      user = result[0];
    }
  }

  const limit_id = `${user.user_id || req.ip}_limit`;

  let limit = user.user_limit;
  let limit_ttl = user.user_limit_ttl;
  if (await getAsync(limit_id)) {
    limit = Number(await getAsync(limit_id));
    limit_ttl = Number(await ttlAsync(limit_id));
  }

  res.json({
    user_id: user.user_id,
    email: user.user_email,
    limit: limit,
    limit_ttl: limit_ttl,
    user_limit: user.user_limit,
    user_limit_ttl: user.user_limit_ttl,
  });
};
