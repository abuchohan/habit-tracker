import { demoBackupPath, writeDemoBackup } from './demo-backup';

writeDemoBackup().then(backup => {
  const habits = backup.records.filter(record => record.kind === 'habit').length;
  console.log(`Created ${habits} habits and ${backup.records.length - habits} entries at ${demoBackupPath}`);
  console.log('No account or database required. In the app, open Settings > Import backup and select this file.');
}).catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
