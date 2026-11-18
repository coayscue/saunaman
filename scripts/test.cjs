const { readdirSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

const directory = join(__dirname, '..', 'server', 'tests');
const tests = readdirSync(directory)
  .filter(filename => filename.endsWith('.test.js'))
  .sort()
  .map(filename => join(directory, filename));
const result = spawnSync(process.execPath, ['--test', ...tests], {
  stdio: 'inherit',
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
