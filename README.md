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
- Milvus 3.0.0+
- FFmpeg
- Docker

### Install

Install Prerequisites first, then:

```bash
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
On every start, it will scan the `VIDEO_PATH` for new video files (.mp4, .mkv, or .webm) and re-scan the `VIDEO_PATH` periodically (default: every 60 seconds, configurable via `SCAN_INTERVAL`, set to `0` or `Infinity` to disable).

### Run as systemd

Put this file to `/etc/systemd/system/trace.moe-api.service`

```ini
[Unit]
Description=trace.moe-api
Wants=network-online.target
After=network-online.target

[Service]
User=____
Group=____
WorkingDirectory=/home/____/project/trace.moe-api
Environment=NODE_ENV=production
Environment=MALLOC_ARENA_MAX=2
ExecStart=/usr/bin/node --dns-result-order=ipv6first --max-old-space-size=512 /home/____/project/trace.moe-api/server.ts
Restart=always

[Install]
WantedBy=multi-user.target
```

### Notes on Color Layout Computation (JavaScript vs. Native C/Rust)

The MPEG-7 Color Layout Descriptor extraction is implemented in pure JavaScript rather than compiled native C/Rust or a custom FFmpeg filter for the following reasons:

1. **Video Decoding is the Bottleneck**: ~90% of processing time is spent inside `libavcodec` decoding the compressed H.264/HEVC bitstream. The actual Color Layout calculation (averaging down to an 8×8 grid and computing an 8×8 2D-DCT) takes under **2% of total time** (< 300 ms for an entire 24-minute episode).
2. **Concurrent Pipeline via OS Pipes**: Because FFmpeg runs as a separate subprocess, video decoding and JavaScript feature extraction run concurrently in a producer-consumer pipeline. Node.js processes frame N in V8 JIT while FFmpeg decodes frame N+1 in parallel, effectively hiding the JavaScript computation time behind video decoding latency.
3. **Portability and Maintenance**: Keeping the algorithm in JavaScript avoids maintaining native C/Rust build toolchains and dependencies across Linux distributions, macOS, and Windows without sacrificing overall processing throughput.
4. **Browser & Client-Side Compatibility**: Writing the algorithm in standard JavaScript allows the exact same code to run in web browsers and client-side extensions (e.g., client-side image hashing) without needing WebAssembly compilation or native binaries.

### Notes on Hardware Accelerated Video Decoding

The majority of videos in trace.moe are 720p with average bitrates around 2 Mbps. These low-resolution, low-bitrate videos do not require heavy decoders and can be processed efficiently by modern multi-core CPUs. Hardware-accelerated decoding introduces memory transfer overhead between CPU and GPU, which negates the performance gain.

Tests indicate that hardware-accelerated decoding yields no performance improvement over modern multi-core CPUs. Due to driver setup complexity and limited video format compatibility, hardware decoding is not used.

Tested on **Ryzen 9 9950X3D** (16 cores / 32 threads, RDNA 2 VCN 3.0 iGPU) with a 720p H.264 23.98 fps 4Mbps video source:

| Concurrency    | CPU (`-threads 0`)     | CPU (`-threads 2`)     | GPU VA-API          | GPU Vulkan          |
| :------------- | :--------------------- | :--------------------- | :------------------ | :------------------ |
| **1 Stream**   | 2,422 fps (101x)       | 669 fps (28x)          | 755 fps (31x)       | 858 fps (36x)       |
| **2 Streams**  | 4,435 fps (93x/ea)     | 1,297 fps (27x/ea)     | 1,087 fps (23x/ea)  | 1,134 fps (24x/ea)  |
| **4 Streams**  | 5,973 fps (62x/ea)     | 2,342 fps (24x/ea)     | 1,106 fps (12x/ea)  | 1,142 fps (12x/ea)  |
| **8 Streams**  | **6,165 fps** _(Peak)_ | 4,210 fps (22x/ea)     | 1,113 fps (6x/ea)   | 1,143 fps (6x/ea)   |
| **16 Streams** | 6,004 fps (17x/ea)     | 5,884 fps (16x/ea)     | 1,110 fps (3x/ea)   | 1,126 fps (3x/ea)   |
| **24 Streams** | 5,733 fps (10x/ea)     | **6,018 fps** _(Peak)_ | 1,111 fps (2x/ea)   | 1,121 fps (2x/ea)   |
| **32 Streams** | 5,770 fps (8x/ea)      | 5,770 fps (8x/ea)      | 1,108 fps (1.4x/ea) | 1,117 fps (1.5x/ea) |

1. **CPU Software Decode (Max Batch Throughput)**:
   - Scales up to **~6,165 Aggregate FPS (~257x real-time)** across the machine.
   - Saturated at **4–8 worker processes** when using `-threads 0` (or 16–24 processes with `-threads 2`).
   - Ideal for fastest offline library indexing when all CPU cores can be dedicated to video processing.

2. **GPU Hardware Decode (VA-API / Vulkan - Low CPU Overhead)**:
   - The fixed-function VCN ASIC decoder caps at **~1,140 Aggregate FPS (~47x real-time)** at > 2 streams.
   - Can sustain **up to ~47 concurrent 720p streams in real-time** with < 5% CPU usage.
   - Ideal for 24/7 background indexing or shared production servers to keep all 32 CPU threads 100% free for database queries, image hashing, and web traffic.
