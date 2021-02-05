module.exports = {
  apps: [
    {
      name: "trace.moe-api",
      script: "server.js",
      instances: 4,
      autorestart: true,
      watch: false,
      exec_mode: "cluster",
    },
  ],
};
