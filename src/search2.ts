import crypto from "node:crypto";
import aniep from "aniep";
import { MilvusClient } from "@zilliz/milvus2-sdk-node";
import sql from "../sql.ts";

const { TRACE_API_SALT, MILVUS_ADDR, MILVUS_TOKEN } = process.env;

const milvus = new MilvusClient({ address: MILVUS_ADDR, token: MILVUS_TOKEN });

export default async (req, res) => {
  const locals = req.app.locals;

  console.log(req.body);

  const searchResult = await milvus.search({
    collection_name: "frame_color_layout",
    data: req.body.vectors,
    limit: 1000,
    filter: Number(req.query.anilistID) ? `anilist_id == ${Number(req.query.anilistID)}` : null,
    output_fields: ["anilist_id", "file_id", "time"],
  });

  console.log(searchResult);

  const results = await Promise.all(
    searchResult.results.map(async (r) => {
      let result = r
        .reduce((list, { score: d, anilist_id, file_id, time }) => {
          // merge nearby results within 5 seconds in the same file
          const fileId = file_id;
          const t = time;
          const index = list.findIndex(
            (e) =>
              e.anilist_id === anilist_id &&
              e.fileId === fileId &&
              (Math.abs(e.from - t) < 5 || Math.abs(e.to - t) < 5),
          );
          if (index < 0) {
            return list.concat({
              anilist_id,
              fileId,
              t,
              from: t,
              to: t,
              d,
            });
          } else {
            list[index].from = list[index].from < t ? list[index].from : t;
            list[index].to = list[index].to > t ? list[index].to : t;
            list[index].d = list[index].d < d ? list[index].d : d;
            list[index].t = list[index].d < d ? list[index].t : t;
            return list;
          }
        }, [])
        .sort((a, b) => a.d - b.d) // sort in ascending order of difference
        .slice(0, 10); // return only top 10 results

      const files = await sql`
        SELECT
          files.id,
          anilist_id,
          season_year,
          season,
          anilist_view.status,
          country_of_origin,
          format,
          is_adult,
          files.duration,
          anilist_view.duration as anilist_duration,
          episode,
          episodes,
          title_native,
          title_romaji,
          path
        FROM
          files
          LEFT JOIN anilist_view ON files.anilist_id = anilist_view.id
        WHERE
          files.id IN ${sql(result.map((e) => e.fileId))}
      `;

      const window = 60 * 60; // snap to nearest hour for better cache
      const expire = ((Date.now() / 1000 / window) | 0) * window + window;
      result = result
        .filter((e) => files.find((f) => f.id === e.fileId))
        .map(({ fileId, t, from, to, d }) => {
          const {
            anilist_id,
            season_year,
            season,
            status,
            country_of_origin,
            format,
            is_adult,
            duration,
            anilist_duration,
            episode,
            episodes,
            title_native,
            title_romaji,
            path,
          } = files.find((f) => f.id === fileId);

          const time = (t * 10000) | 0; // convert 4dp time code to integer
          const buf = Buffer.from(TRACE_API_SALT);
          buf.writeUInt32LE(Math.abs(time ^ expire ^ fileId));
          const hash = Buffer.from(
            crypto.createHash("sha1").update(buf).digest("binary"),
          ).readUInt32LE();
          const previewId = locals.sqids.encode([fileId, time, expire, hash]);

          return {
            anilist: {
              id: anilist_id,
              title_native,
              title_romaji,
              season_year,
              season,
              status,
              country_of_origin,
              format,
              episodes,
              is_adult,
              duration: anilist_duration,
            },
            filename: path.split("/").pop(),
            episode,
            ep: aniep(path.split("/").pop()),
            from: Number(from.toFixed(4)),
            at: Number(t.toFixed(4)),
            to: Number(to.toFixed(4)),
            duration,
            similarity: Math.min(Math.max(0, (255 - d) / 255), 1),
            video: `${req.protocol}://${req.get("host")}/video/${previewId}`,
            image: `${req.protocol}://${req.get("host")}/image/${previewId}`,
          };
        });

      return result;
    }),
  );

  res.json({
    frameCount: Number(searchResult.all_search_count),
    error: "",
    results,
  });
};
