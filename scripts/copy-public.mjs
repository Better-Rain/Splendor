import { cpSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, 'public');
const targetDir = path.join(rootDir, 'dist', 'renderer');

if (!existsSync(sourceDir)) {
  process.exit(0);
}

mkdirSync(targetDir, { recursive: true });

for (const entry of readdirSync(sourceDir)) {
  cpSync(path.join(sourceDir, entry), path.join(targetDir, entry), {
    force: true,
    recursive: true
  });
}
