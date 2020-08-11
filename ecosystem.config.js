module.exports = {
  apps: [
    {
      name: "trace.moe-api",
      script: "index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      exec_mode: "fork",
    },
  ],
};
