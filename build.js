const esbuild = require('esbuild');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const entry = path.resolve(__dirname, 'src/index.ts');
const dist = path.resolve(__dirname, 'dist');

console.log('Building...', entry);

fs.rmSync(dist, { recursive: true, force: true });

// Type declarations (dist/index.d.ts + one .d.ts per source file)
execSync('tsc --emitDeclarationOnly', { stdio: 'inherit' });

const shared = {
  entryPoints: [entry],
  bundle: true,
  target: 'es2018',
  sourcemap: true,
};

Promise.all([
  // CommonJS for Node.js (`require`)
  esbuild.build({ ...shared, outfile: './dist/node.js', platform: 'node', format: 'cjs' }),
  // ESM for bundlers, browsers and Node.js `import`. The code has no platform-specific APIs.
  esbuild.build({ ...shared, outfile: './dist/index.mjs', platform: 'neutral', format: 'esm' }),
])
  .then(() => console.log('Built dist/node.js, dist/index.mjs and type declarations.'))
  .catch(() => process.exit(1));
