# syntax=docker/dockerfile:1

FROM node:lts-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY ["package.json", "package-lock.json*", "./"]
RUN npm remove --save opencv4nodejs && npm install --production
COPY . .
CMD [ "node", "server-ws.js" ]