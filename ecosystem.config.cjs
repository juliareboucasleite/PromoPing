module.exports = {
  apps: [
    {
      name: "promoping-web",
      script: "backend/server.js",
      cwd: ".",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 4000,
      max_restarts: 30,
      kill_timeout: 10000,
      env: {
        NODE_ENV: "production"
      }
    },
    {
      name: "promoping-bot",
      script: "backend/discord-bot/index.js",
      cwd: ".",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 7000,
      max_restarts: 50,
      kill_timeout: 10000,
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
