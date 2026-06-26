# syntax=docker/dockerfile:1

FROM node:lts-trixie-slim
RUN apt-get update && apt-get install -y ffmpeg tini && rm -rf /var/lib/apt/lists/*
ENTRYPOINT ["/usr/bin/tini", "--"]
ENV NODE_ENV=production
WORKDIR /app
RUN touch /app/.env
COPY ["package.json", "package-lock.json*", "./"]
RUN npm install --omit=dev
COPY . .
CMD [ "node", "server.ts" ]
