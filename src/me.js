require("dotenv").config();
const redis = require("redis");
const client = redis.createClient();
const util = require("util");
const getAsync = util.promisify(client.get).bind(client);
const ttlAsync = util.promisify(client.ttl).bind(client);

const {
  SOLA_DB_HOST,
  SOLA_DB_PORT,
  SOLA_DB_USER,
  SOLA_DB_PWD,
  SOLA_DB_NAME
} = process.env;

const knex = require("knex")({
  client: "mysql",
  connection: {
    host: SOLA_DB_HOST,
    port: SOLA_DB_PORT,
    user: SOLA_DB_USER,
    password: SOLA_DB_PWD,
    database: SOLA_DB_NAME
  }
});

module.exports = async ctx => {
  let user = {
    user_id: null,
    user_email: ctx.request.ip,
    user_limit: 10,
    user_limit_ttl: 60,
    user_quota: 150,
    user_quota_ttl: 86400
  };

  if (ctx.request.query.token) {
    const result = await knex("users")
      .select(
        "user_id",
        "email",
        "user_limit",
        "user_limit_ttl",
        "user_quota",
        "user_quota_ttl"
      )
      .where("api_key", ctx.request.query.token);

    if (result.length === 0) {
      ctx.body = `"error: invalid token"`;
      return;
    } else {
      user = result[0];
    }
  }

  const limit_id = `${user.user_id || ctx.request.ip}_limit`;
  const quota_id = `${user.user_id || ctx.request.ip}_quota`;

  let limit = user.user_limit;
  let limit_ttl = user.user_limit_ttl;
  if (await getAsync(limit_id)) {
    limit = Number(await getAsync(limit_id));
    limit_ttl = Number(await ttlAsync(limit_id));
  }

  let quota = user.user_quota;
  let quota_ttl = user.user_quota_ttl;
  if (await getAsync(quota_id)) {
    quota = Number(await getAsync(quota_id));
    quota_ttl = Number(await ttlAsync(quota_id));
  }

  ctx.body = {
    user_id: user.user_id,
    email: user.user_email,
    limit: limit,
    limit_ttl: limit_ttl,
    quota: quota,
    quota_ttl: quota_ttl,
    user_limit: user.user_limit,
    user_limit_ttl: user.user_limit_ttl,
    user_quota: user.user_quota,
    user_quota_ttl: user.user_quota_ttl
  };
};
