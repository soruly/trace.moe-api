# trace.moe-api

[![License](https://img.shields.io/github/license/soruly/trace.moe-api.svg?style=flat-square)](https://github.com/soruly/trace.moe-api/blob/master/LICENSE)
[![GitHub Workflow Status](https://img.shields.io/github/workflow/status/soruly/trace.moe-api/Node.js%20CI?style=flat-square)](https://github.com/soruly/trace.moe-api/actions)
[![Discord](https://img.shields.io/discord/437578425767559188.svg?style=flat-square)](https://discord.gg/K9jn6Kj)

API server for [trace.moe](https://github.com/soruly/trace.moe)

[API Docs](https://soruly.github.io/trace.moe-api/)

### Features

- serve image search request
- crop black borders on search images
- rate limiting and user management
- serve server and database status
- create solr cores
- store and serve compressed hash files
- serve workers and mange video and hash status

### Prerequisites

- Node.js 14.x
- mariaDB 10.4.x
- apache solr 7.x
- redis
- git
- g++, cmake (for compiling OpenCV)
- [pm2](https://pm2.keymetrics.io/)

### Install

Install Prerequisites first, then:

```
git clone https://github.com/soruly/trace.moe-api.git
cd trace.moe-api
npm install
```

### Configuration

- Copy `.env.example` to `.env`
- Edit `.env` as appropriate for your setup

### Start server

You can use pm2 to run this in background in cluster mode.

Use below commands to start / restart / stop server.

```
npm run start
npm run stop
npm run reload
npm run restart
npm run delete
```

To change the number of nodejs instances, edit ecosystem.config.json
