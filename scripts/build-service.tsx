/**
 * Production build for a service: bundles server.tsx and the shared
 * @doctor-tracker/common package into dist/server.js; third-party packages stay
 * external and are resolved from node_modules at runtime. Run from a service dir.
 */
import { build } from 'esbuild';
import path from 'node:path';

const serviceDir = process.cwd();
const entryFile = process.argv[2] || 'server.tsx';
const outFile = process.argv[3] || 'dist/server.js';

build({
  entryPoints: [path.resolve(serviceDir, entryFile)],
  outfile: path.resolve(serviceDir, outFile),
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  sourcemap: true,
  logLevel: 'info',
  plugins: [
    {
      name: 'externalize-node-modules',
      setup(b) {
        // Keep relative imports and the workspace package in the bundle; everything else is external.
        b.onResolve({ filter: /^[^./]/ }, (args) => {
          // Entry points and absolute paths (e.g. "F:\..." on Windows) are not packages.
          if (args.kind === 'entry-point' || path.isAbsolute(args.path)) return undefined;
          return args.path.startsWith('@doctor-tracker/') ? undefined : { path: args.path, external: true };
        });
      },
    },
  ],
}).catch(() => process.exit(1));
