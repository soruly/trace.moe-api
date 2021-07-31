# syntax=docker/dockerfile:1

FROM node:lts-alpine
RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]
ENV NODE_ENV=production
WORKDIR /app
COPY ["package.json", "package-lock.json*", "./"]
RUN npm remove --save opencv4nodejs && npm install --production
COPY . .
CMD [ "node", "server-ws.js" ]