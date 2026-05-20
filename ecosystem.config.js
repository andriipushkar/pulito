// PM2 process config for the pulito Next.js app.
// Apply with: pm2 startOrReload ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'pulito',
      cwd: '/home/pulitotrade/pulito',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      exec_mode: 'fork',
      instances: 1,
      // Cap V8 old-generation heap so we trip a clean OOM instead of swap-thrashing.
      node_args: '--max-old-space-size=512',
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
      },
      // Avoid log files growing without bound — pm2-logrotate handles rotation,
      // but make sure new lines flush promptly.
      out_file: '/home/pulitotrade/.pm2/logs/pulito-out.log',
      error_file: '/home/pulitotrade/.pm2/logs/pulito-error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
