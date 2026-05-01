const fs = require("fs");
const path = require("path");

const isWindows = process.platform === "win32";
const venvPython = path.join(
  __dirname,
  ".venv",
  isWindows ? "Scripts" : "bin",
  isWindows ? "python.exe" : "python"
);
const pythonInterpreter = fs.existsSync(venvPython)
  ? venvPython
  : (isWindows ? "python" : "python3");

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
    },
    {
      name: "promoping-scraper",
      script: "start.py",
      cwd: "python-scraper",
      interpreter: pythonInterpreter,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      restart_delay: 5000,
      max_restarts: 50,
      kill_timeout: 10000,
      env: {
        NODE_ENV: "production",
        PYTHONUNBUFFERED: "1"
      }
    }
  ]
};
