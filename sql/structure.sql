-- Adminer 4.8.1 MySQL 5.5.5-10.5.12-MariaDB dump

SET NAMES utf8;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `cl` (
  `path` varchar(768) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('UPLOADED','HASHING','HASHED','LOADING','LOADED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`path`),
  KEY `status` (`status`),
  KEY `created` (`created`),
  KEY `updated` (`updated`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `log` (
  `time` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00' ON UPDATE current_timestamp(),
  `uid` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` smallint(5) unsigned NOT NULL,
  `search_time` int(6) unsigned DEFAULT NULL,
  `accuracy` float(20) unsigned DEFAULT NULL,
  KEY `time_uid_status` (`time`,`uid`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stat_count_hour` (
  `time` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `total` int(11) NOT NULL,
  `200` int(11) NOT NULL,
  `400` int(11) NOT NULL,
  `402` int(11) NOT NULL,
  `405` int(11) NOT NULL,
  `500` int(11) NOT NULL,
  `503` int(11) NOT NULL,
  PRIMARY KEY (`time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stat_speed_hour` (
  `time` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `p0` int(11) NOT NULL,
  `p10` int(11) NOT NULL,
  `p25` int(11) NOT NULL,
  `p50` int(11) NOT NULL,
  `p75` int(11) NOT NULL,
  `p90` int(11) NOT NULL,
  `p100` int(11) NOT NULL,
  PRIMARY KEY (`time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stat_speed_day` (
  `time` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `p0` int(11) NOT NULL,
  `p10` int(11) NOT NULL,
  `p25` int(11) NOT NULL,
  `p50` int(11) NOT NULL,
  `p75` int(11) NOT NULL,
  `p90` int(11) NOT NULL,
  `p100` int(11) NOT NULL,
  PRIMARY KEY (`time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stat_accuracy_hour` (
  `time` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `p0` FLOAT NOT NULL,
  `p10` FLOAT NOT NULL,
  `p25` FLOAT NOT NULL,
  `p50` FLOAT NOT NULL,
  `p75` FLOAT NOT NULL,
  `p90` FLOAT NOT NULL,
  `p100` FLOAT NOT NULL,
  PRIMARY KEY (`time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stat_accuracy_day` (
  `time` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `p0` FLOAT NOT NULL,
  `p10` FLOAT NOT NULL,
  `p25` FLOAT NOT NULL,
  `p50` FLOAT NOT NULL,
  `p75` FLOAT NOT NULL,
  `p90` FLOAT NOT NULL,
  `p100` FLOAT NOT NULL,
  PRIMARY KEY (`time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP VIEW IF EXISTS `stat_count_day`;
CREATE TABLE `stat_count_day` (`time` datetime /* mariadb-5.3 */, `total` decimal(32,0), `200` decimal(32,0), `400` decimal(32,0), `402` decimal(32,0), `405` decimal(32,0), `500` decimal(32,0), `503` decimal(32,0));


DROP VIEW IF EXISTS `stat_count_month`;
CREATE TABLE `stat_count_month` (`time` datetime /* mariadb-5.3 */, `total` decimal(32,0), `200` decimal(32,0), `400` decimal(32,0), `402` decimal(32,0), `405` decimal(32,0), `500` decimal(32,0), `503` decimal(32,0));


DROP VIEW IF EXISTS `stat_count_year`;
CREATE TABLE `stat_count_year` (`time` datetime /* mariadb-5.3 */, `total` decimal(32,0), `200` decimal(32,0), `400` decimal(32,0), `402` decimal(32,0), `405` decimal(32,0), `500` decimal(32,0), `503` decimal(32,0));


DROP VIEW IF EXISTS `log_speed_daily`;
CREATE TABLE `log_speed_daily` (`period` date, `p0` double(17,0), `p10` double(17,0), `p25` double(17,0), `p50` double(17,0), `p75` double(17,0), `p90` double(17,0), `p100` double(17,0));


DROP VIEW IF EXISTS `log_speed_hourly`;
CREATE TABLE `log_speed_hourly` (`period` varchar(20), `p0` double(17,0), `p10` double(17,0), `p25` double(17,0), `p50` double(17,0), `p75` double(17,0), `p90` double(17,0), `p100` double(17,0));


DROP VIEW IF EXISTS `log_speed_monthly`;
CREATE TABLE `log_speed_monthly` (`period` varchar(7), `p0` double(17,0), `p10` double(17,0), `p25` double(17,0), `p50` double(17,0), `p75` double(17,0), `p90` double(17,0), `p100` double(17,0));


DROP VIEW IF EXISTS `log_accuracy_daily`;
CREATE TABLE `log_accuracy_daily` (`period` date, `p0` double(17,0), `p10` double(17,0), `p25` double(17,0), `p50` double(17,0), `p75` double(17,0), `p90` double(17,0), `p100` double(17,0));


DROP VIEW IF EXISTS `log_accuracy_hourly`;
CREATE TABLE `log_accuracy_hourly` (`period` varchar(20), `p0` double(17,0), `p10` double(17,0), `p25` double(17,0), `p50` double(17,0), `p75` double(17,0), `p90` double(17,0), `p100` double(17,0));


DROP VIEW IF EXISTS `log_accuracy_monthly`;
CREATE TABLE `log_accuracy_monthly` (`period` varchar(7), `p0` double(17,0), `p10` double(17,0), `p25` double(17,0), `p50` double(17,0), `p75` double(17,0), `p90` double(17,0), `p100` double(17,0));


DROP VIEW IF EXISTS `log_view`;
CREATE TABLE `log_view` (`uid` varchar(45), `count` bigint(21));


CREATE TABLE IF NOT EXISTS `mediainfo` (
  `path` varchar(768) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  `created` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `updated` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `json` longtext COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`path`),
  KEY `created` (`created`),
  KEY `updated` (`updated`),
  CONSTRAINT `CONSTRAINT_1` CHECK (json_valid(`json`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP VIEW IF EXISTS `media_audio_bit_rate`;
CREATE TABLE `media_audio_bit_rate` (`bit_rate` decimal(23,0), `count` bigint(21));


DROP VIEW IF EXISTS `media_audio_channel`;
CREATE TABLE `media_audio_channel` (`audio_channel` bigint(21), `count` bigint(21));


DROP VIEW IF EXISTS `media_audio_codec`;
CREATE TABLE `media_audio_codec` (`audio_codec_name` longtext, `count` bigint(21));


DROP VIEW IF EXISTS `media_audio_profile`;
CREATE TABLE `media_audio_profile` (`audio_profile` longtext, `count` bigint(21));


DROP VIEW IF EXISTS `media_display_aspect_ratio`;
CREATE TABLE `media_display_aspect_ratio` (`display_aspect_ratio` longtext, `count` bigint(21));


DROP VIEW IF EXISTS `media_duration_average`;
CREATE TABLE `media_duration_average` (`seconds` double, `minutes` double);


DROP VIEW IF EXISTS `media_duration_total`;
CREATE TABLE `media_duration_total` (`seconds` double, `hours` double);


DROP VIEW IF EXISTS `media_fps`;
CREATE TABLE `media_fps` (`round(fps)` double(17,0), `count` bigint(21));


DROP VIEW IF EXISTS `media_frames_total`;
CREATE TABLE `media_frames_total` (`sum` double);


DROP VIEW IF EXISTS `media_info`;
CREATE TABLE `media_info` (`path` varchar(768), `streams` int(10), `display_aspect_ratio` longtext, `width` longtext, `height` longtext, `pix_fmt` longtext, `nb_frames` longtext, `fps` double(20,3), `video_codec_name` longtext, `video_profile` longtext, `video_level` longtext, `video_bit_rate` bigint(21), `audio_codec_name` longtext, `audio_profile` longtext, `audio_bit_rate` bigint(21), `audio_channel` bigint(21), `sample_rate` bigint(21), `duration` float);


DROP VIEW IF EXISTS `media_pix_fmt`;
CREATE TABLE `media_pix_fmt` (`pix_fmt` longtext, `count` bigint(21));


DROP VIEW IF EXISTS `media_sample_rate`;
CREATE TABLE `media_sample_rate` (`sample_rate` bigint(21), `count` bigint(21));


DROP VIEW IF EXISTS `media_streams`;
CREATE TABLE `media_streams` (`streams` int(10), `count` bigint(21));


DROP VIEW IF EXISTS `media_video_bit_rate`;
CREATE TABLE `media_video_bit_rate` (`bit_rate` decimal(25,0), `count` bigint(21));


DROP VIEW IF EXISTS `media_video_codec`;
CREATE TABLE `media_video_codec` (`video_codec_name` longtext, `count` bigint(21));


DROP VIEW IF EXISTS `media_video_level`;
CREATE TABLE `media_video_level` (`video_level` longtext, `count` bigint(21));


DROP VIEW IF EXISTS `media_video_profile`;
CREATE TABLE `media_video_profile` (`video_profile` longtext, `count` bigint(21));


DROP VIEW IF EXISTS `media_width_height`;
CREATE TABLE `media_width_height` (`width` longtext, `height` longtext, `count` bigint(21));


CREATE TABLE IF NOT EXISTS `search_count` (
  `uid` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `count` int(10) unsigned NOT NULL,
  PRIMARY KEY (`uid`),
  KEY `uid` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP VIEW IF EXISTS `status`;
CREATE TABLE `status` (`status` enum('UPLOADED','HASHING','HASHED','LOADING','LOADED'), `COUNT(*)` bigint(21));


CREATE TABLE IF NOT EXISTS `tier` (
  `id` tinyint(3) unsigned NOT NULL AUTO_INCREMENT,
  `priority` tinyint(3) unsigned NOT NULL,
  `concurrency` tinyint(3) unsigned NOT NULL,
  `quota` int(10) unsigned NOT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `patreon_id` int(10) unsigned NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `user` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(256) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `password` varchar(256) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `api_key` varchar(128) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL,
  `tier` tinyint(3) unsigned DEFAULT NULL,
  `notes` text COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id_2` (`id`),
  UNIQUE KEY `api_key_2` (`api_key`),
  KEY `user_id` (`id`),
  KEY `email` (`email`(255)),
  KEY `api_key` (`api_key`),
  KEY `tier` (`tier`),
  CONSTRAINT `user_ibfk_1` FOREIGN KEY (`tier`) REFERENCES `tier` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci ROW_FORMAT=COMPACT;


DROP VIEW IF EXISTS `user_quota`;
CREATE TABLE `user_quota` (`uid` varchar(45), `count` bigint(21));


DROP VIEW IF EXISTS `user_view`;
CREATE TABLE `user_view` (`id` int(10) unsigned, `email` varchar(256), `api_key` varchar(128), `tier` tinyint(3) unsigned, `priority` tinyint(3) unsigned, `concurrency` tinyint(3) unsigned, `quota` int(10) unsigned);


CREATE TABLE IF NOT EXISTS `webhook` (
  `time` timestamp NULL DEFAULT current_timestamp(),
  `type` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `json` longtext COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  CONSTRAINT `CONSTRAINT_1` CHECK (json_valid(`json`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `stat_count_day`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `stat_count_day` AS select cast(date_format(`stat_count_hour`.`time`,'%Y-%m-%d 00:00:00') as datetime) AS `time`,sum(`stat_count_hour`.`total`) AS `total`,sum(`stat_count_hour`.`200`) AS `200`,sum(`stat_count_hour`.`400`) AS `400`,sum(`stat_count_hour`.`402`) AS `402`,sum(`stat_count_hour`.`405`) AS `405`,sum(`stat_count_hour`.`500`) AS `500`,sum(`stat_count_hour`.`503`) AS `503` from `stat_count_hour` group by date_format(`stat_count_hour`.`time`,'%Y-%m-%d 00:00:00');

DROP TABLE IF EXISTS `stat_count_month`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `stat_count_month` AS select cast(date_format(`stat_count_hour`.`time`,'%Y-%m-01 00:00:00') as datetime) AS `time`,sum(`stat_count_hour`.`total`) AS `total`,sum(`stat_count_hour`.`200`) AS `200`,sum(`stat_count_hour`.`400`) AS `400`,sum(`stat_count_hour`.`402`) AS `402`,sum(`stat_count_hour`.`405`) AS `405`,sum(`stat_count_hour`.`500`) AS `500`,sum(`stat_count_hour`.`503`) AS `503` from `stat_count_hour` group by date_format(`stat_count_hour`.`time`,'%Y-%m-01 00:00:00');

DROP TABLE IF EXISTS `stat_count_year`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `stat_count_year` AS select cast(date_format(`stat_count_hour`.`time`,'%Y-01-01 00:00:00') as datetime) AS `time`,sum(`stat_count_hour`.`total`) AS `total`,sum(`stat_count_hour`.`200`) AS `200`,sum(`stat_count_hour`.`400`) AS `400`,sum(`stat_count_hour`.`402`) AS `402`,sum(`stat_count_hour`.`405`) AS `405`,sum(`stat_count_hour`.`500`) AS `500`,sum(`stat_count_hour`.`503`) AS `503` from `stat_count_hour` group by date_format(`stat_count_hour`.`time`,'%Y-01-01 00:00:00');

DROP TABLE IF EXISTS `log_speed_daily`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `log_speed_daily` AS select distinct cast(`log`.`time` as date) AS `period`,round(percentile_cont(0) within group ( order by `log`.`search_time`) over ( partition by cast(`log`.`time` as date)),0) AS `p0`,round(percentile_cont(0.1) within group ( order by `log`.`search_time`) over ( partition by cast(`log`.`time` as date)),0) AS `p10`,round(percentile_cont(0.25) within group ( order by `log`.`search_time`) over ( partition by cast(`log`.`time` as date)),0) AS `p25`,round(percentile_cont(0.5) within group ( order by `log`.`search_time`) over ( partition by cast(`log`.`time` as date)),0) AS `p50`,round(percentile_cont(0.75) within group ( order by `log`.`search_time`) over ( partition by cast(`log`.`time` as date)),0) AS `p75`,round(percentile_cont(0.9) within group ( order by `log`.`search_time`) over ( partition by cast(`log`.`time` as date)),0) AS `p90`,round(percentile_cont(1) within group ( order by `log`.`search_time`) over ( partition by cast(`log`.`time` as date)),0) AS `p100` from `log` where `log`.`time` >= current_timestamp() + interval -30 day;

DROP TABLE IF EXISTS `log_speed_hourly`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `log_speed_hourly` AS select distinct date_format(`log`.`time`,'%Y-%m-%d %H00') AS `period`,round(percentile_cont(0) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m-%d %H00')),0) AS `p0`,round(percentile_cont(0.1) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m-%d %H00')),0) AS `p10`,round(percentile_cont(0.25) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m-%d %H00')),0) AS `p25`,round(percentile_cont(0.5) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m-%d %H00')),0) AS `p50`,round(percentile_cont(0.75) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m-%d %H00')),0) AS `p75`,round(percentile_cont(0.9) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m-%d %H00')),0) AS `p90`,round(percentile_cont(1) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m-%d %H00')),0) AS `p100` from `log` where `log`.`time` >= current_timestamp() + interval -48 day_hour;

DROP TABLE IF EXISTS `log_speed_monthly`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `log_speed_monthly` AS select distinct date_format(`log`.`time`,'%Y-%m') AS `period`,round(percentile_cont(0) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m')),0) AS `p0`,round(percentile_cont(0.1) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m')),0) AS `p10`,round(percentile_cont(0.25) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m')),0) AS `p25`,round(percentile_cont(0.5) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m')),0) AS `p50`,round(percentile_cont(0.75) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m')),0) AS `p75`,round(percentile_cont(0.9) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m')),0) AS `p90`,round(percentile_cont(1) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m')),0) AS `p100` from `log` where `log`.`time` >= current_timestamp() + interval -365 day;

DROP TABLE IF EXISTS `log_accuracy_daily`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `log_accuracy_daily` AS select distinct cast(`log`.`time` as date) AS `period`,percentile_cont(0) within group ( order by `log`.`accuracy`) over ( partition by cast(`log`.`time` as date)) AS `p0`,percentile_cont(0.1) within group ( order by `log`.`accuracy`) over ( partition by cast(`log`.`time` as date)) AS `p10`,percentile_cont(0.25) within group ( order by `log`.`accuracy`) over ( partition by cast(`log`.`time` as date)) AS `p25`,percentile_cont(0.5) within group ( order by `log`.`accuracy`) over ( partition by cast(`log`.`time` as date)) AS `p50`,percentile_cont(0.75) within group ( order by `log`.`accuracy`) over ( partition by cast(`log`.`time` as date)) AS `p75`,percentile_cont(0.9) within group ( order by `log`.`accuracy`) over ( partition by cast(`log`.`time` as date)) AS `p90`,percentile_cont(1) within group ( order by `log`.`accuracy`) over ( partition by cast(`log`.`time` as date)) AS `p100` from `log` where `log`.`time` >= current_timestamp() + interval -30 day;

DROP TABLE IF EXISTS `log_accuracy_hourly`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `log_accuracy_hourly` AS select distinct date_format(`log`.`time`,'%Y-%m-%d %H00') AS `period`,percentile_cont(0) within group ( order by `log`.`accuracy`) over ( partition by date_format(`log`.`time`,'%Y-%m-%d %H00')) AS `p0`,percentile_cont(0.1) within group ( order by `log`.`accuracy`) over ( partition by date_format(`log`.`time`,'%Y-%m-%d %H00')) AS `p10`,percentile_cont(0.25) within group ( order by `log`.`accuracy`) over ( partition by date_format(`log`.`time`,'%Y-%m-%d %H00')) AS `p25`,percentile_cont(0.5) within group ( order by `log`.`accuracy`) over ( partition by date_format(`log`.`time`,'%Y-%m-%d %H00')) AS `p50`,percentile_cont(0.75) within group ( order by `log`.`accuracy`) over ( partition by date_format(`log`.`time`,'%Y-%m-%d %H00')) AS `p75`,percentile_cont(0.9) within group ( order by `log`.`accuracy`) over ( partition by date_format(`log`.`time`,'%Y-%m-%d %H00')) AS `p90`,percentile_cont(1) within group ( order by `log`.`accuracy`) over ( partition by date_format(`log`.`time`,'%Y-%m-%d %H00')) AS `p100` from `log` where `log`.`time` >= current_timestamp() + interval -48 day_hour;

DROP TABLE IF EXISTS `log_accuracy_monthly`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `log_accuracy_monthly` AS select distinct date_format(`log`.`time`,'%Y-%m') AS `period`,percentile_cont(0) within group ( order by `log`.`accuracy`) over ( partition by date_format(`log`.`time`,'%Y-%m')) AS `p0`,percentile_cont(0.1) within group ( order by `log`.`accuracy`) over ( partition by date_format(`log`.`time`,'%Y-%m')) AS `p10`,percentile_cont(0.25) within group ( order by `log`.`accuracy`) over ( partition by date_format(`log`.`time`,'%Y-%m')) AS `p25`,percentile_cont(0.5) within group ( order by `log`.`accuracy`) over ( partition by date_format(`log`.`time`,'%Y-%m')) AS `p50`,percentile_cont(0.75) within group ( order by `log`.`accuracy`) over ( partition by date_format(`log`.`time`,'%Y-%m')) AS `p75`,percentile_cont(0.9) within group ( order by `log`.`accuracy`) over ( partition by date_format(`log`.`time`,'%Y-%m')) AS `p90`,percentile_cont(1) within group ( order by `log`.`accuracy`) over ( partition by date_format(`log`.`time`,'%Y-%m')) AS `p100` from `log` where `log`.`time` >= current_timestamp() + interval -365 day;

DROP TABLE IF EXISTS `log_view`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `log_view` AS select `log`.`uid` AS `uid`,count(0) AS `count` from `log` group by `log`.`uid` order by count(0) desc;

DROP TABLE IF EXISTS `media_audio_bit_rate`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `media_audio_bit_rate` AS select ceiling(`media_info`.`audio_bit_rate` / 10000) * 10 AS `bit_rate`,count(0) AS `count` from `media_info` group by ceiling(`media_info`.`audio_bit_rate` / 10000) * 10;

DROP TABLE IF EXISTS `media_audio_channel`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `media_audio_channel` AS select `media_info`.`audio_channel` AS `audio_channel`,count(0) AS `count` from `media_info` group by `media_info`.`audio_channel`;

DROP TABLE IF EXISTS `media_audio_codec`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `media_audio_codec` AS select `media_info`.`audio_codec_name` AS `audio_codec_name`,count(0) AS `count` from `media_info` group by `media_info`.`audio_codec_name`;

DROP TABLE IF EXISTS `media_audio_profile`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `media_audio_profile` AS select `media_info`.`audio_profile` AS `audio_profile`,count(0) AS `count` from `media_info` group by `media_info`.`audio_profile`;

DROP TABLE IF EXISTS `media_display_aspect_ratio`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `media_display_aspect_ratio` AS select `media_info`.`display_aspect_ratio` AS `display_aspect_ratio`,count(0) AS `count` from `media_info` group by `media_info`.`display_aspect_ratio`;

DROP TABLE IF EXISTS `media_duration_average`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `media_duration_average` AS select avg(`media_info`.`duration`) AS `seconds`,avg(`media_info`.`duration`) / 60 AS `minutes` from `media_info`;

DROP TABLE IF EXISTS `media_duration_total`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `media_duration_total` AS select sum(`media_info`.`duration`) AS `seconds`,sum(`media_info`.`duration`) / 3600 AS `hours` from `media_info`;

DROP TABLE IF EXISTS `media_fps`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `media_fps` AS select round(`media_info`.`fps`,0) AS `round(fps)`,count(0) AS `count` from `media_info` group by round(`media_info`.`fps`,0);

DROP TABLE IF EXISTS `media_frames_total`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `media_frames_total` AS select sum(`media_info`.`nb_frames`) AS `sum` from `media_info`;

DROP TABLE IF EXISTS `media_info`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `media_info` AS select `mediainfo`.`path` AS `path`,json_length(`mediainfo`.`json`,'$.streams') AS `streams`,json_value(`mediainfo`.`json`,'$.streams[0].display_aspect_ratio') AS `display_aspect_ratio`,json_value(`mediainfo`.`json`,'$.streams[0].width') AS `width`,json_value(`mediainfo`.`json`,'$.streams[0].height') AS `height`,json_value(`mediainfo`.`json`,'$.streams[0].pix_fmt') AS `pix_fmt`,json_value(`mediainfo`.`json`,'$.streams[0].nb_frames') AS `nb_frames`,round(cast(json_value(`mediainfo`.`json`,'$.streams[0].nb_frames') as signed) / cast(json_value(`mediainfo`.`json`,'$.format.duration') as float),3) AS `fps`,json_value(`mediainfo`.`json`,'$.streams[0].codec_name') AS `video_codec_name`,json_value(`mediainfo`.`json`,'$.streams[0].profile') AS `video_profile`,json_value(`mediainfo`.`json`,'$.streams[0].level') AS `video_level`,cast(json_value(`mediainfo`.`json`,'$.streams[0].bit_rate') as signed) AS `video_bit_rate`,json_value(`mediainfo`.`json`,'$.streams[1].codec_name') AS `audio_codec_name`,json_value(`mediainfo`.`json`,'$.streams[1].profile') AS `audio_profile`,cast(json_value(`mediainfo`.`json`,'$.streams[1].bit_rate') as signed) AS `audio_bit_rate`,cast(json_value(`mediainfo`.`json`,'$.streams[1].channels') as signed) AS `audio_channel`,cast(json_value(`mediainfo`.`json`,'$.streams[1].sample_rate') as signed) AS `sample_rate`,cast(json_value(`mediainfo`.`json`,'$.format.duration') as float) AS `duration` from `mediainfo`;

DROP TABLE IF EXISTS `media_pix_fmt`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `media_pix_fmt` AS select `media_info`.`pix_fmt` AS `pix_fmt`,count(0) AS `count` from `media_info` group by `media_info`.`pix_fmt`;

DROP TABLE IF EXISTS `media_sample_rate`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `media_sample_rate` AS select `media_info`.`sample_rate` AS `sample_rate`,count(0) AS `count` from `media_info` group by `media_info`.`sample_rate`;

DROP TABLE IF EXISTS `media_streams`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `media_streams` AS select `media_info`.`streams` AS `streams`,count(0) AS `count` from `media_info` group by `media_info`.`streams`;

DROP TABLE IF EXISTS `media_video_bit_rate`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `media_video_bit_rate` AS select ceiling(`media_info`.`video_bit_rate` / 1000000) * 1000 AS `bit_rate`,count(0) AS `count` from `media_info` group by ceiling(`media_info`.`video_bit_rate` / 1000000) * 1000;

DROP TABLE IF EXISTS `media_video_codec`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `media_video_codec` AS select `media_info`.`video_codec_name` AS `video_codec_name`,count(0) AS `count` from `media_info` group by `media_info`.`video_codec_name`;

DROP TABLE IF EXISTS `media_video_level`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `media_video_level` AS select `media_info`.`video_level` AS `video_level`,count(0) AS `count` from `media_info` group by `media_info`.`video_level`;

DROP TABLE IF EXISTS `media_video_profile`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `media_video_profile` AS select `media_info`.`video_profile` AS `video_profile`,count(0) AS `count` from `media_info` group by `media_info`.`video_profile`;

DROP TABLE IF EXISTS `media_width_height`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `media_width_height` AS select `media_info`.`width` AS `width`,`media_info`.`height` AS `height`,count(0) AS `count` from `media_info` group by `media_info`.`width`,`media_info`.`height`;

DROP TABLE IF EXISTS `status`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `status` AS select `cl`.`status` AS `status`,count(0) AS `COUNT(*)` from `cl` group by `cl`.`status`;

DROP TABLE IF EXISTS `user_quota`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `user_quota` AS select `log`.`uid` AS `uid`,count(0) AS `count` from `log` where `log`.`status` = 200 and `log`.`time` >= date_format(current_timestamp(),'%Y-%m-01 00:00:00') group by `log`.`uid`;

DROP TABLE IF EXISTS `user_view`;
CREATE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `user_view` AS select `user`.`id` AS `id`,`user`.`email` AS `email`,`user`.`api_key` AS `api_key`,`user`.`tier` AS `tier`,`tier`.`priority` AS `priority`,`tier`.`concurrency` AS `concurrency`,`tier`.`quota` AS `quota` from (`user` left join `tier` on(`user`.`tier` = `tier`.`id`));

-- 2021-12-06 03:55:26