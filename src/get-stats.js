let lastUpdate = "";
let mediaCount = 0;
let mediaFramesTotal = 0;
let mediaDurationTotal = 0;

export default async (req, res) => {
  const knex = req.app.locals.knex;

  const { type, period } = req.query;
  if (type === "media") {
    const [updated] = await knex("mediainfo").orderBy("updated", "desc").select("updated").limit(1);
    if (lastUpdate !== updated.updated.toISOString()) {
      const [mediainfo, media_frames_total, media_duration_total] = await Promise.all([
        knex("mediainfo").count("* as sum"),
        knex("media_frames_total"),
        knex("media_duration_total").select("seconds"),
      ]);
      mediaCount = mediainfo[0].sum;
      mediaFramesTotal = media_frames_total[0].sum;
      mediaDurationTotal = media_duration_total[0].seconds;
      lastUpdate = updated.updated.toISOString();
    }
    return res.json({
      mediaCount,
      mediaFramesTotal,
      mediaDurationTotal,
      lastUpdate,
    });
  }
  if (
    ["traffic", "performance", "accuracy"].includes(type) &&
    !["hourly", "monthly", "daily", "hour", "day", "month", "year"].includes(period)
  ) {
    return res.status(400).json({
      error: "Invalid period",
    });
  }

  const hourFloor = (date) =>
    new Date(date.toISOString().replace(/T(\d+):(\d+):(\d+)\.\d+Z/, " $1:00:00"));

  if (type === "traffic") {
    const [lastCached] = await knex("stat_count_hour").orderBy("time", "desc");
    const thisHour = hourFloor(new Date());
    const lastHour = hourFloor(new Date(thisHour.valueOf() - 1000 * 60 * 60));
    if (!lastCached || lastCached.time.valueOf() < lastHour.valueOf()) {
      const cached = (await knex("stat_count_hour").distinct("time")).map((e) => e.time.valueOf());
      const [firstRecord] = await knex("log").orderBy("time", "asc").limit(1);
      let time = hourFloor(firstRecord ? firstRecord.time : new Date());
      while (time.valueOf() <= lastHour.valueOf()) {
        const start = hourFloor(time);
        time = new Date(time.valueOf() + 60 * 60 * 1000);
        const end = hourFloor(time);
        if (!cached.includes(start.valueOf())) {
          const rows = await knex("log")
            .where("time", ">=", start)
            .andWhere("time", "<", end)
            .groupBy("status")
            .select(["status", knex.raw("count(*) as `count`")]);

          await knex("stat_count_hour").insert({
            time: start,
            total: rows.reduce((acc, cur) => acc + cur.count, 0),
            200: rows?.find((e) => e.status === 200)?.count ?? 0,
            400: rows?.find((e) => e.status === 400)?.count ?? 0,
            402: rows?.find((e) => e.status === 402)?.count ?? 0,
            405: rows?.find((e) => e.status === 405)?.count ?? 0,
            500: rows?.find((e) => e.status === 500)?.count ?? 0,
            503: rows?.find((e) => e.status === 503)?.count ?? 0,
          });
        }
      }
    }

    const history = await knex(`stat_count_${period}`)
      .orderBy("time", "desc")
      .limit(
        {
          hour: 48,
          day: 30,
          month: 12,
        }[period] ?? 50
      );
    const latest = await knex("log")
      .where("time", ">=", thisHour)
      .groupBy("status")
      .select(["status", knex.raw("count(*) as `count`")]);

    const partial = {
      time: thisHour,
      total: latest.reduce((acc, cur) => acc + cur.count, 0),
      200: latest?.find((e) => e.status === 200)?.count ?? 0,
      400: latest?.find((e) => e.status === 400)?.count ?? 0,
      402: latest?.find((e) => e.status === 402)?.count ?? 0,
      405: latest?.find((e) => e.status === 405)?.count ?? 0,
      500: latest?.find((e) => e.status === 500)?.count ?? 0,
      503: latest?.find((e) => e.status === 503)?.count ?? 0,
    };

    if (period === "hour") {
      history.unshift(partial);
    } else {
      if (history.length) {
        history[0] = {
          200: history[0]["200"] + partial["200"],
          400: history[0]["400"] + partial["400"],
          402: history[0]["402"] + partial["402"],
          405: history[0]["405"] + partial["405"],
          500: history[0]["500"] + partial["500"],
          503: history[0]["503"] + partial["503"],
          time: history[0].time,
          total: history[0]?.total + partial.total,
        };
      }
    }

    return res.json(history);
  }
  if (type === "performance") {
    const rows = await knex(`log_speed_${period}`);
    return res.json(rows);
  }
  if (type === "accuracy") {
    const rows = await knex(`log_accuracy_${period}`);
    return res.json(rows);
  }
  return res.status(400).json({
    error: "Invalid param",
  });
};
