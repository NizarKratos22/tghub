import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/main.ts', 'src/seed/index.ts', 'src/scripts/promote-admin.ts', 'src/scripts/register-discord-commands.ts', 'src/scripts/media-to-r2.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // The shared package ships as TypeScript source, so it is bundled in.
  noExternal: ['@tgh/shared'],
});
