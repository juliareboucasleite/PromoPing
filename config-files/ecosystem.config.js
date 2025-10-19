module.exports = {
  apps: [
    {
      name: 'promoping-api',
      script: 'backend/server.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024'
    }
  ],

  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'https://github.com/juliareboucasleite/PromoPing-2.0.git',
      path: '/var/www/PromoPing-2.0',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && pm2 reload config-files/ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
