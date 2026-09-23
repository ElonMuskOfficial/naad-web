import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const html = fs.readFileSync(path.join(process.cwd(), 'build', '200.html'), 'utf8');
const files = [];
const re = /_app\/immutable\/([^"\s]+\.js)/g;
let m = re.exec(html);
while (m !== null) {
  files.push(m[1]);
  m = re.exec(html);
}
const unique = [...new Set(files)];
let totalGz = 0;
let totalRaw = 0;
for (const f of unique) {
  const p = path.join(process.cwd(), '.svelte-kit', 'output', 'client', '_app', 'immutable', f);
  if (fs.existsSync(p)) {
    const b = fs.readFileSync(p);
    totalRaw += b.length;
    totalGz += zlib.gzipSync(b).length;
  }
}
console.log(
  `First-load JS: ${(totalRaw / 1024).toFixed(1)} KB (${(totalGz / 1024).toFixed(1)} KB gzip) across ${unique.length} files`,
);
