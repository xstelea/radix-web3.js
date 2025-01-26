import { defineConfig } from 'tsup'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/manifests/index.ts',
    'src/account/index.ts',
    'src/keypairs/index.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  clean: true,
  minify: true,
})
