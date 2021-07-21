-- Adminer 4.8.1 MySQL 5.5.5-10.5.11-MariaDB dump

SET NAMES utf8;
SET time_zone = '+00:00';
SET foreign_key_checks = 0;
SET sql_mode = 'NO_AUTO_VALUE_ON_ZERO';

SET NAMES utf8mb4;

INSERT IGNORE INTO `tier` (`id`, `priority`, `concurrency`, `quota`, `notes`, `patreon_id`) VALUES
(0,	0,	1,	1000,	'public',	0),
(1,	2,	1,	1000,	'$1',	0),
(2,	2,	1,	5000,	'$5',	0),
(3,	5,	1,	10000,	'$10',	0),
(4,	5,	2,	20000,	'$20',	0),
(5,	5,	3,	50000,	'$50',	0),
(6,	6,	4,	100000,	'$100',	0),
(9,	9,	255,	4294967295,	'god',	0);

-- 2021-07-21 09:06:02