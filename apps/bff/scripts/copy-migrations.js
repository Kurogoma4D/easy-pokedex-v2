// マイグレーション SQL は tsc がコピーしないため、ビルド後に dist/db/migrations/ へ複製する。
import { cp } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, 'src', 'db', 'migrations');
const dest = join(root, 'dist', 'db', 'migrations');

await cp(src, dest, { recursive: true });
