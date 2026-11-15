import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../public/js/', import.meta.url));
const files = [];

(function walk(directory) {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (path.endsWith('.js')) files.push(path);
  }
})(root);

let failed = 0;

for (const file of files) {
  const label = file.slice(root.length).replaceAll('\\', '/');
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    console.log(`  ok   js/${label}`);
  } catch (error) {
    failed++;
    console.error(`  FAIL js/${label}`);
    console.error(String(error.stderr ?? error.message));
  }
}

console.log(`\n${files.length - failed}/${files.length} archivos válidos.`);
process.exit(failed === 0 ? 0 : 1);
