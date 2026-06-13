import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/bin/rdx.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
});
