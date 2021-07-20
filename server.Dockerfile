# syntax=docker/dockerfile:1

FROM node:lts-buster
RUN apt-get update && apt-get install -y ffmpeg cmake
ENV NODE_ENV=production
WORKDIR /app
COPY ["package.json", "package-lock.json*", "./"]
RUN npm install --production
COPY . .
CMD [ "node", "server.js" ]