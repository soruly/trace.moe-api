let lastUpdate = "";
let mediaCount = 0;
let mediaFramesTotal = 0;
let mediaDurationTotal = 0;

export default async (req, res) => {
  const knex = req.app.locals.knex;

  const { type, period } = req.query;
  if (type === "media") {
    const [row] = await knex("mediainfo").max("updated", { as: "lastUpdated" });
    const lastUpdatedRecordValue = row?.lastUpdated?.toISOString() ?? null;

    if (lastUpdatedRecordValue && lastUpdate !== lastUpdatedRecordValue) {
      const [mediainfo, media_frames_total, media_duration_total] = await Promise.all([
        knex("mediainfo").count("* as sum"),
        knex("media_frames_total"),
        knex("media_duration_total").select("seconds"),
      ]);
      mediaCount = mediainfo[0].sum;
      mediaFramesTotal = media_frames_total[0].sum;
      mediaDurationTotal = media_duration_total[0].seconds;
      lastUpdate = lastUpdatedRecordValue;
    }

    return res.json({
      mediaCount,
      mediaFramesTotal,
      mediaDurationTotal,
      lastUpdate,
    });
  }

  const periodFloor = (date, period) =>
    new Date(
      date
        .toISOString()
        .replace(/T(\d+):(\d+):(\d+)\.\d+Z/, period === "day" ? " 00:00:00" : " $1:00:00"),
    );

  if (type === "traffic") {
    if (!["hour", "day", "month", "year"].includes(period)) {
      return res.status(400).json({
        error: "Invalid period",
      });
    }
    const [lastCached] = await knex("stat_count_hour").orderBy("time", "desc");
    const thisHour = periodFloor(new Date());
    const lastHour = periodFloor(new Date(thisHour.valueOf() - 1000 * 60 * 60));
    if (!lastCached || lastCached.time.valueOf() < lastHour.valueOf()) {
      const cached = (await knex("stat_count_hour").distinct("time")).map((e) => e.time.valueOf());
      const [firstRecord] = await knex("log").orderBy("time", "asc").limit(1);
      let time = periodFloor(firstRecord ? firstRecord.time : new Date());
      while (time.valueOf() <= lastHour.valueOf()) {
        const start = periodFloor(time);
        time = new Date(time.valueOf() + 1000 * 60 * 60);
        const end = periodFloor(time);
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
        }[period] ?? 50,
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
  } else if (type === "speed" || type === "accuracy") {
    if (!["hour", "day"].includes(period)) {
      return res.status(400).json({
        error: "Invalid period",
      });
    }

    const sqlSelectStr =
      type === "speed"
        ? [
            "round(percentile_cont(0) within group ( order by `search_time`) over (),0) AS `p0`",
            "round(percentile_cont(0.1) within group ( order by `search_time`) over (),0) AS `p10`",
            "round(percentile_cont(0.25) within group ( order by `search_time`) over (),0) AS `p25`",
            "round(percentile_cont(0.5) within group ( order by `search_time`) over (),0) AS `p50`",
            "round(percentile_cont(0.75) within group ( order by `search_time`) over (),0) AS `p75`",
            "round(percentile_cont(0.9) within group ( order by `search_time`) over (),0) AS `p90`",
            "round(percentile_cont(1) within group ( order by `search_time`) over (),0) AS `p100`",
          ].map((e) => knex.raw(e))
        : [
            "percentile_cont(0) within group ( order by `accuracy`) over () AS `p0`",
            "percentile_cont(0.1) within group ( order by `accuracy`) over () AS `p10`",
            "percentile_cont(0.25) within group ( order by `accuracy`) over () AS `p25`",
            "percentile_cont(0.5) within group ( order by `accuracy`) over () AS `p50`",
            "percentile_cont(0.75) within group ( order by `accuracy`) over () AS `p75`",
            "percentile_cont(0.9) within group ( order by `accuracy`) over () AS `p90`",
            "percentile_cont(1) within group ( order by `accuracy`) over () AS `p100`",
          ].map((e) => knex.raw(e));

    const [lastCached] = await knex(`stat_${type}_${period}`).orderBy("time", "desc");
    const thisPeriod = periodFloor(new Date(), period);
    const lastPeriod = periodFloor(
      new Date(thisPeriod.valueOf() - 1000 * 60 * 60 * (period === "day" ? 24 : 1)),
      period,
    );
    if (!lastCached || lastCached.time.valueOf() < lastPeriod.valueOf()) {
      const cached = (await knex(`stat_${type}_${period}`).distinct("time")).map((e) =>
        e.time.valueOf(),
      );
      const [firstRecord] = await knex("log").orderBy("time", "asc").limit(1);
      let time = periodFloor(firstRecord ? firstRecord.time : new Date(), period);
      while (time.valueOf() <= lastPeriod.valueOf()) {
        const start = periodFloor(time, period);
        time = new Date(time.valueOf() + 1000 * 60 * 60 * (period === "day" ? 24 : 1));
        const end = periodFloor(time, period);
        if (!cached.includes(start.valueOf())) {
          const [rows] = await knex("log")
            .where("time", ">=", start)
            .andWhere("time", "<", end)
            .whereNotNull(type === "speed" ? "search_time" : "accuracy")
            .select(sqlSelectStr)
            .limit(1);

          await knex(`stat_${type}_${period}`).insert(
            rows
              ? {
                  time: start,
                  ...rows,
                }
              : {
                  time: start,
                  p0: 0,
                  p10: 0,
                  p25: 0,
                  p50: 0,
                  p75: 0,
                  p90: 0,
                  p100: 0,
                },
          );
        }
      }
    }

    const history = await knex(`stat_${type}_${period}`)
      .orderBy("time", "desc")
      .limit(period === "day" ? 30 : 48);
    const [latest] = await knex("log")
      .where("time", ">=", thisPeriod)
      .andWhere("status", 200)
      .select(sqlSelectStr)
      .limit(1);

    history.unshift(
      latest
        ? {
            time: thisPeriod,
            ...latest,
          }
        : {
            time: thisPeriod,
            p0: 0,
            p10: 0,
            p25: 0,
            p50: 0,
            p75: 0,
            p90: 0,
            p100: 0,
          },
    );
    return res.json(history);
  }
  return res.status(400).json({
    error: "Invalid type",
  });
};
