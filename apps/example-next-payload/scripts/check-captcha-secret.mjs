import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2).filter((arg) => arg !== '--');
if (args.length > 1) throw new Error('Expected at most one test secret argument.');
const secret = args[0] ?? 'buildr-captcha-client-leak-test-secret';
if (!secret) throw new Error('Provide a non-empty test secret.');
const root = fileURLToPath(new URL('../.next/', import.meta.url));

async function scan(directory, needle, textOnly = false) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return { count: 0, leaks: [] };
    throw error;
  }
  const result = { count: 0, leaks: [] };
  for (const entry of entries) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await scan(filename, needle, textOnly);
      result.count += nested.count;
      result.leaks.push(...nested.leaks);
    } else if (!textOnly || /\.(html|rsc|body|meta|json|js|txt|map)$/i.test(entry.name)) {
      result.count++;
      if ((await readFile(filename)).includes(needle)) result.leaks.push(filename);
    }
  }
  return result;
}

// Exercise the same scanner and every supported page-content extension before trusting it.
const temporary = await mkdtemp(path.join(tmpdir(), 'buildr-captcha-'));
try {
  for (const extension of ['html', 'rsc', 'body', 'meta', 'json', 'js', 'txt', 'map']) {
    await writeFile(path.join(temporary, `planted.${extension}`), secret);
  }
  const planted = await scan(temporary, Buffer.from(secret), true);
  if (planted.count !== 8 || planted.leaks.length !== 8) {
    throw new Error('Captcha scanner self-test failed.');
  }
} finally {
  await rm(temporary, { recursive: true, force: true });
}
console.log('Captcha scanner self-test passed (8 planted file types).');

// Only the wrapper writes provenance, after a successful build with all four variables.
// Bind it to BUILD_ID so an ordinary rebuild cannot reuse the marker.
let sentinelBuild = false;
try {
  const marker = JSON.parse(await readFile(path.join(root, 'captcha-sentinel.json'), 'utf8'));
  const buildId = (await readFile(path.join(root, 'BUILD_ID'), 'utf8')).trim();
  sentinelBuild = marker.buildId === buildId && marker.secret === secret;
} catch {
  // Missing or malformed provenance fails closed.
}
if (!sentinelBuild) {
  throw new Error('build was not made with the captcha sentinel env; run the documented command');
}
const leaks = [];
for (const [directory, textOnly] of [
  ['static', false],
  ['server/app', true],
  ['server/pages', true],
]) {
  const result = await scan(path.join(root, directory), Buffer.from(secret), textOnly);
  console.log(`.next/${directory}: ${result.count} files scanned.`);
  if (directory === 'static' && !result.count) throw new Error('No built client output found.');
  leaks.push(...result.leaks);
}
if (leaks.length) {
  throw new Error(
    `Captcha test secret leaked into ${leaks.map((file) => path.relative(root, file)).join(', ')}`,
  );
}
console.log('Captcha secret absent from built client and page content.');
