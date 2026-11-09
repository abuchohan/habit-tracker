const { spawnSync } = require('node:child_process');
const result = spawnSync(process.execPath, [require.resolve('expo/bin/cli'), 'export', '--platform', 'web'], {
  stdio: 'inherit', env: { ...process.env, EXPO_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || '/api' },
});
process.exit(result.status ?? 1);
