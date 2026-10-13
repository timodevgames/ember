#!/usr/bin/env node
// Bundles server/index.ts (+ shared src/ modules) into one dependency-free file.
// The version (git sha + build time) is baked in so /health proves which code is live.
import { build } from 'esbuild';
import { execSync } from 'node:child_process';

let sha = 'dev';
try {
  sha = execSync('git rev-parse --short HEAD').toString().trim();
  if (execSync('git status --porcelain').toString().trim()) sha += '+dirty';
} catch {
  /* not a git checkout */
}
const version = `${sha}@${new Date().toISOString().slice(0, 16)}`;

await build({
  entryPoints: ['server/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: 'server/dist/index.mjs',
  define: { __VERSION__: JSON.stringify(version) },
  banner: { js: '// habits-api — built from github.com/timodevgames/ember (server/). Do not edit here.' },
  logLevel: 'warning',
});
console.log(`built server/dist/index.mjs (${version})`);
