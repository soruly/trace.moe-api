# AGENTS.md

## Project Overview

**trace.moe-api** is the core backend HTTP API server and data processing service for trace.moe (anime scene search engine).

### Core Tech Stack

- **Runtime**: Node.js >= 24 (runs `.ts` files directly via native TypeScript support)
- **Framework**: Express 5
- **Databases**: PostgreSQL (`postgres`), Milvus Vector DB (`@zilliz/milvus2-sdk-node`)
- **Image & Media Processing**: `sharp`, `aniep`, native C11 extractor (`libavformat`, `libavcodec`, `libswscale`, `libzstd`) with JS fallback
- **Code Formatting & Quality**: Prettier, `oxfmt`

---

## Directory Structure

```
├── server.ts                    # Main API server entry point
├── env.ts                       # Environment variable parsing & validation
├── sql.ts                       # PostgreSQL client connection instance
├── dependency-check.ts          # Service health check script (PostgreSQL, Milvus, FFmpeg)
├── swagger.yaml                 # OpenAPI 3.0 API specification
├── compose.yml                  # Docker Compose configuration (PostgreSQL, Milvus)
├── Makefile                     # Native C extractor build script (pkg-config)
├── src/                         # Core API endpoints & business logic
│   ├── app.ts                   # Express application setup & middleware
│   ├── search.ts                # Main scene search handler (/search)
│   ├── image.ts                 # Image proxy & crop handler (/image)
│   ├── video.ts                 # Video preview proxy handler (/video)
│   ├── get-me.ts                # User quota & profile handler (/me)
│   ├── get-stats.ts             # System metrics handler (/stats)
│   ├── get-status.ts            # System status handler (/status)
│   ├── tasks.ts                 # Task queue status handler (/tasks)
│   ├── lib/                     # Server utility modules (detect-scene, color-layout, safe-fetch, etc.)
│   ├── native/                  # Native C11 color layout extractor (libav* + libzstd)
│   │   ├── color_layout.h       # Color layout descriptor header
│   │   ├── color_layout.c       # MPEG-7 Color Layout Descriptor algorithm
│   │   └── main.c               # Video decoding, extraction, and zstd CLI entry point
│   ├── user/                    # User authentication & key management handlers
│   ├── webhook/                 # Webhook integration handlers
│   └── worker/                  # Background worker routines
├── script/                      # Database & media processing scripts
│   ├── check-similarity.ts      # Scene similarity validation script
│   ├── check-subtitles.ts       # Subtitle search validation script
│   ├── bulk-load-milvus.ts      # Milvus vector bulk loading script
│   ├── anilist.ts               # AniList media sync script
│   └── cleanup.ts               # Temporary file cleanup script
├── sql/                         # Database initialization schemas
│   └── 1.init.sql               # Initial PostgreSQL tables & indexes
├── .env.example                 # Environment configuration template
└── package.json                 # Project dependencies & npm scripts
```

---

## Command Reference

| Action                  | Command                | Notes                                           |
| :---------------------- | :--------------------- | :---------------------------------------------- |
| **Start Server**        | `npm run start`        | Starts API server (`node server.ts`)            |
| **Build Native Tool**   | `npm run build:native` | Compiles native C extractor (`make`)            |
| **Lint / Format Check** | `npm run lint`         | Checks code formatting using Prettier           |
| **Format Code**         | `npm run format`       | Auto-formats all project files using Prettier   |
| **Run TS File Direct**  | `node <filepath>.ts`   | Executes any `.ts` script directly with Node 24 |

---

## Coding & Operational Guidelines

### 1. Direct TypeScript Execution

- This project always runs TypeScript files directly with Node.js >= 24 (e.g. `node script.ts`) without using `tsc`, `ts-node`, or `--strip-types`.

### 2. Native Extractor & Fallback

- The native extractor binary (`trace-moe-colorlayout`) is built via `make` and used automatically on Linux when present.
- On non-Linux platforms (macOS/Windows) or when the binary is absent, the worker gracefully falls back to the pure JavaScript + `ffmpeg` pipeline.

### 3. PostgreSQL Docker Execution

- When PostgreSQL is running in a Docker container, use `psql` via:
  ```bash
  docker exec -i tracemoe-api-postgres-1 psql -U postgres -d postgres -c "..."
  ```

### 4. Verification Workflow

Before submitting changes, ensure lint and formatting checks pass:

```bash
npm run lint
```
