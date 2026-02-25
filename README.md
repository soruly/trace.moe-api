# trace.moe-api

[![License](https://img.shields.io/github/license/soruly/trace.moe-api.svg?style=flat-square)](https://github.com/soruly/trace.moe-api/blob/master/LICENSE)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/soruly/trace.moe-api/docker-image.yml?style=flat-square)](https://github.com/soruly/trace.moe-api/actions)
[![Docker](https://img.shields.io/docker/pulls/soruly/trace.moe-api?style=flat-square)](https://hub.docker.com/r/soruly/trace.moe-api)
[![Docker Image Size](https://img.shields.io/docker/image-size/soruly/trace.moe-api/latest?style=flat-square)](https://hub.docker.com/r/soruly/trace.moe-api)
[![Discord](https://img.shields.io/discord/437578425767559188.svg?style=flat-square)](https://discord.gg/K9jn6Kj)

API server for [trace.moe](https://github.com/soruly/trace.moe)

[API Docs](https://soruly.github.io/trace.moe-api/)

### Features

- serve image search request
- crop black borders on search images
- rate limiting and user management
- serve index and database status
- store and serve compressed hash files
- distribute hash jobs to workers

### Prerequisites

- Node.js >= 22.15
- PostgreSQL 17+
- Milvus 2.6.0+
- FFmpeg
- Docker

### Install

Install Prerequisites first, then:

```
git clone https://github.com/soruly/trace.moe-api.git
cd trace.moe-api
npm install
```

### Getting Started

- Copy `.env.example` to `.env`
- Edit `.env` as appropriate for your setup, i.e. `VIDEO_PATH`.
- Change `TRACE_API_SALT` to a unique value of at least 32 characters.
- `docker compose up -d`
- `node server.ts`

On the first start, it will create all database tables in postgresql and create the collection in milvus.
On every start, it will scan the `VIDEO_PATH` for new video files (.mp4, .mkv, or .webm) and re-scan the `VIDEO_PATH` every minute for new video files.

### Running in background

You can use [pm2](https://pm2.keymetrics.io/) to run this in background in cluster mode.

Use below commands to start / restart / stop server.

```
npm run start
npm run stop
npm run reload
npm run restart
npm run delete
```
