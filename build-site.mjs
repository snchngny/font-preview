import {cp, lstat, mkdir, readFile, readdir, rm, stat, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const output = path.join(root, 'dist');
const fontsDir = path.join(root, 'fonts');
const manifest = JSON.parse(await readFile(path.join(fontsDir, 'sources.json'), 'utf8'));

if (path.dirname(output) !== root) throw new Error('Output must stay inside the project');
const existing = await lstat(output).catch(error => { if (error.code !== 'ENOENT') throw error; });
if (existing?.isSymbolicLink()) throw new Error('Output must not be a symbolic link');
await rm(output, {recursive: true, force: true});
await mkdir(output, {recursive: true});
await cp(path.join(root, 'index.html'), path.join(output, 'index.html'));
await cp(fontsDir, path.join(output, 'fonts'), {recursive: true});

const rules = ['/* Generated from fonts/sources.json; original font files are served separately. */'];
for (const font of manifest.files) {
  if (!font.filename || !font.family || font.weight === undefined) {
    throw new Error('Invalid font entry in fonts/sources.json');
  }
  const filename = path.join(fontsDir, font.filename);
  const bytes = await readFile(filename);
  if (font.bytes !== bytes.length) throw new Error(`Font size does not match manifest: ${font.filename}`);
  if (createHash('sha256').update(bytes).digest('hex') !== font.sha256) throw new Error(`Font hash does not match manifest: ${font.filename}`);
  const extension = path.extname(font.filename).toLowerCase();
  const format = extension === '.otf' ? 'opentype' : extension === '.ttf' ? 'truetype' : null;
  if (!format) throw new Error(`Unsupported font file: ${font.filename}`);
  rules.push(`@font-face{font-family:${JSON.stringify(font.family)};font-style:normal;font-weight:${font.weight};font-display:swap;src:url(${JSON.stringify(`fonts/${font.filename}`)}) format(${JSON.stringify(format)});}`);
}
await writeFile(path.join(output, 'bundled-fonts.css'), `${rules.join('\n')}\n`);

async function filesUnder(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  const nested = await Promise.all(entries.map(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(file) : [file];
  }));
  return nested.flat();
}
for (const file of await filesUnder(output)) {
  const size = (await stat(file)).size;
  if (size > 25 * 1024 * 1024) throw new Error(`Cloudflare Pages asset exceeds 25 MiB: ${path.relative(output, file)}`);
}
console.log(`Built dist with ${manifest.files.length} fonts; all assets are below 25 MiB.`);
