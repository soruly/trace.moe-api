let lastUpdate = "";
let mediaCount = 0;
let mediaFramesTotal = 0;
let mediaDurationTotal = 0;

export default async (req, res) => {
  const knex = app.locals.knex;

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
  if (!["hourly", "monthly", "daily"].includes(period)) {
    return res.status(400).json({
      error: "Invalid period",
    });
  }
  if (type === "traffic") {
    const rows = await knex(`log_${period}`);
    return res.json(rows.slice(-36));
  }
  if (type === "performance") {
    const rows = await knex(`log_speed_${period}`);
    return res.json(rows.slice(-36));
  }
  return res.status(400).json({
    error: "Invalid param",
  });
};
