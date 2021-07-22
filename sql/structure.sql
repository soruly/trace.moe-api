-- Adminer 4.8.1 MySQL 5.5.5-10.5.11-MariaDB dump

SET NAMES utf8;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

SET NAMES utf8mb4;

CREATE TABLE IF NOT EXISTS `anilist` (
  `id` int(10) unsigned NOT NULL,
  `json` longtext COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `CONSTRAINT_1` CHECK (json_valid(`json`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `anilist_chinese` (
  `id` int(10) unsigned NOT NULL,
  `json` longtext COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `CONSTRAINT_1` CHECK (json_valid(`json`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `anilist_view` (`id` int(10) unsigned, `json` longtext);


CREATE TABLE IF NOT EXISTS `cl` (
  `path` varchar(768) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` enum('UPLOADED','HASHING','HASHED','LOADING','LOADED') COLLATE utf8mb4_unicode_ci NOT NULL,
  `created` datetime NOT NULL DEFAULT current_timestamp(),
  `updated` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`path`),
  KEY `status` (`status`),
  KEY `created` (`created`),
  KEY `updated` (`updated`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `log` (
  `time` datetime NOT NULL DEFAULT '0000-00-00 00:00:00' ON UPDATE current_timestamp(),
  `uid` varchar(45) COLLATE utf8mb4_unicode_ci NOT NULL,
  `status` smallint(5) unsigned NOT NULL,
  `search_time` int(6) unsigned DEFAULT NULL,
  KEY `time_uid_status` (`time`,`uid`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS `log_daily` (`period` date, `total` bigint(21), `200` decimal(22,0), `400` decimal(22,0), `402` decimal(22,0), `405` decimal(22,0), `503` decimal(22,0));


CREATE TABLE IF NOT EXISTS `log_hourly` (`period` varchar(20), `total` bigint(21), `200` decimal(22,0), `400` decimal(22,0), `402` decimal(22,0), `405` decimal(22,0), `503` decimal(22,0));


CREATE TABLE IF NOT EXISTS `log_monthly` (`period` varchar(7), `total` bigint(21), `200` decimal(22,0), `400` decimal(22,0), `402` decimal(22,0), `405` decimal(22,0), `503` decimal(22,0));


CREATE TABLE IF NOT EXISTS `log_speed_daily` (`period` date, `p0` double(17,0), `p10` double(17,0), `p25` double(17,0), `p50` double(17,0), `p75` double(17,0), `p90` double(17,0), `p100` double(17,0));


CREATE TABLE IF NOT EXISTS `log_speed_hourly` (`period` varchar(20), `p0` double(17,0), `p10` double(17,0), `p25` double(17,0), `p50` double(17,0), `p75` double(17,0), `p90` double(17,0), `p100` double(17,0));


CREATE TABLE IF NOT EXISTS `log_speed_monthly` (`period` varchar(7), `p0` double(17,0), `p10` double(17,0), `p25` double(17,0), `p50` double(17,0), `p75` double(17,0), `p90` double(17,0), `p100` double(17,0));


CREATE TABLE IF NOT EXISTS `log_view` (`uid` varchar(45), `count` bigint(21));


CREATE TABLE IF NOT EXISTS `status` (`status` enum('UPLOADED','HASHING','HASHED','LOADING','LOADED'), `COUNT(*)` bigint(21));


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


CREATE TABLE IF NOT EXISTS `user_quota` (`uid` varchar(45), `count` bigint(21));


CREATE TABLE IF NOT EXISTS `user_view` (`id` int(10) unsigned, `email` varchar(256), `api_key` varchar(128), `tier` tinyint(3) unsigned, `priority` tinyint(3) unsigned, `concurrency` tinyint(3) unsigned, `quota` int(10) unsigned);


CREATE TABLE IF NOT EXISTS `webhook` (
  `time` datetime DEFAULT current_timestamp(),
  `type` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `json` longtext COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  CONSTRAINT `CONSTRAINT_1` CHECK (json_valid(`json`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


DROP TABLE IF EXISTS `anilist_view`;
CREATE OR REPLACE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `anilist_view` AS select `anilist`.`id` AS `id`,json_merge_preserve(`anilist`.`json`,ifnull(`anilist_chinese`.`json`,json_object('title',json_object('chinese',NULL),'synonyms_chinese',json_array()))) AS `json` from (`anilist` left join `anilist_chinese` on(`anilist`.`id` = `anilist_chinese`.`id`));

DROP TABLE IF EXISTS `log_daily`;
CREATE OR REPLACE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `log_daily` AS select cast(`log`.`time` as date) AS `period`,count(0) AS `total`,sum(if(`log`.`status` = 200,1,0)) AS `200`,sum(if(`log`.`status` = 400,1,0)) AS `400`,sum(if(`log`.`status` = 402,1,0)) AS `402`,sum(if(`log`.`status` = 405,1,0)) AS `405`,sum(if(`log`.`status` = 503,1,0)) AS `503` from `log` where `log`.`time` >= current_timestamp() + interval -30 day group by cast(`log`.`time` as date);

DROP TABLE IF EXISTS `log_hourly`;
CREATE OR REPLACE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `log_hourly` AS select date_format(`log`.`time`,'%Y-%m-%d %H00') AS `period`,count(0) AS `total`,sum(if(`log`.`status` = 200,1,0)) AS `200`,sum(if(`log`.`status` = 400,1,0)) AS `400`,sum(if(`log`.`status` = 402,1,0)) AS `402`,sum(if(`log`.`status` = 405,1,0)) AS `405`,sum(if(`log`.`status` = 503,1,0)) AS `503` from `log` where `log`.`time` >= current_timestamp() + interval -36 day_hour group by date_format(`log`.`time`,'%Y-%m-%d %H00');

DROP TABLE IF EXISTS `log_monthly`;
CREATE OR REPLACE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `log_monthly` AS select date_format(`log`.`time`,'%Y-%m') AS `period`,count(0) AS `total`,sum(if(`log`.`status` = 200,1,0)) AS `200`,sum(if(`log`.`status` = 400,1,0)) AS `400`,sum(if(`log`.`status` = 402,1,0)) AS `402`,sum(if(`log`.`status` = 405,1,0)) AS `405`,sum(if(`log`.`status` = 503,1,0)) AS `503` from `log` where `log`.`time` >= current_timestamp() + interval -365 day group by date_format(`log`.`time`,'%Y-%m');

DROP TABLE IF EXISTS `log_speed_daily`;
CREATE OR REPLACE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `log_speed_daily` AS select distinct cast(`log`.`time` as date) AS `period`,round(percentile_cont(0) within group ( order by `log`.`search_time`) over ( partition by cast(`log`.`time` as date)),0) AS `p0`,round(percentile_cont(0.1) within group ( order by `log`.`search_time`) over ( partition by cast(`log`.`time` as date)),0) AS `p10`,round(percentile_cont(0.25) within group ( order by `log`.`search_time`) over ( partition by cast(`log`.`time` as date)),0) AS `p25`,round(percentile_cont(0.5) within group ( order by `log`.`search_time`) over ( partition by cast(`log`.`time` as date)),0) AS `p50`,round(percentile_cont(0.75) within group ( order by `log`.`search_time`) over ( partition by cast(`log`.`time` as date)),0) AS `p75`,round(percentile_cont(0.9) within group ( order by `log`.`search_time`) over ( partition by cast(`log`.`time` as date)),0) AS `p90`,round(percentile_cont(1) within group ( order by `log`.`search_time`) over ( partition by cast(`log`.`time` as date)),0) AS `p100` from `log` where `log`.`time` >= current_timestamp() + interval -30 day;

DROP TABLE IF EXISTS `log_speed_hourly`;
CREATE OR REPLACE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `log_speed_hourly` AS select distinct date_format(`log`.`time`,'%Y-%m-%d %H00') AS `period`,round(percentile_cont(0) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m-%d %H00')),0) AS `p0`,round(percentile_cont(0.1) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m-%d %H00')),0) AS `p10`,round(percentile_cont(0.25) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m-%d %H00')),0) AS `p25`,round(percentile_cont(0.5) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m-%d %H00')),0) AS `p50`,round(percentile_cont(0.75) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m-%d %H00')),0) AS `p75`,round(percentile_cont(0.9) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m-%d %H00')),0) AS `p90`,round(percentile_cont(1) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m-%d %H00')),0) AS `p100` from `log` where `log`.`time` >= current_timestamp() + interval -36 day_hour;

DROP TABLE IF EXISTS `log_speed_monthly`;
CREATE OR REPLACE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `log_speed_monthly` AS select distinct date_format(`log`.`time`,'%Y-%m') AS `period`,round(percentile_cont(0) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m')),0) AS `p0`,round(percentile_cont(0.1) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m')),0) AS `p10`,round(percentile_cont(0.25) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m')),0) AS `p25`,round(percentile_cont(0.5) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m')),0) AS `p50`,round(percentile_cont(0.75) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m')),0) AS `p75`,round(percentile_cont(0.9) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m')),0) AS `p90`,round(percentile_cont(1) within group ( order by `log`.`search_time`) over ( partition by date_format(`log`.`time`,'%Y-%m')),0) AS `p100` from `log` where `log`.`time` >= current_timestamp() + interval -365 day;

DROP TABLE IF EXISTS `log_view`;
CREATE OR REPLACE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `log_view` AS select `log`.`uid` AS `uid`,count(0) AS `count` from `log` group by `log`.`uid` order by count(0) desc;

DROP TABLE IF EXISTS `status`;
CREATE OR REPLACE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `status` AS select `cl`.`status` AS `status`,count(0) AS `COUNT(*)` from `cl` group by `cl`.`status`;

DROP TABLE IF EXISTS `user_quota`;
CREATE OR REPLACE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `user_quota` AS select `log`.`uid` AS `uid`,count(0) AS `count` from `log` where `log`.`status` = 200 and `log`.`time` >= date_format(current_timestamp(),'%Y-%m-01 00:00:00') group by `log`.`uid`;

DROP TABLE IF EXISTS `user_view`;
CREATE OR REPLACE ALGORITHM=UNDEFINED SQL SECURITY DEFINER VIEW `user_view` AS select `user`.`id` AS `id`,`user`.`email` AS `email`,`user`.`api_key` AS `api_key`,`user`.`tier` AS `tier`,`tier`.`priority` AS `priority`,`tier`.`concurrency` AS `concurrency`,`tier`.`quota` AS `quota` from (`user` left join `tier` on(`user`.`tier` = `tier`.`id`));

-- 2021-07-22 08:15:39