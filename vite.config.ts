import { loadEnv, type Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';
import { assertContent } from './src/content/validate';
import { isStrictEnv, previewHashFor, MIN_PREVIEW_KEY_LENGTH } from './tools/buildEnv';

/** In a strict (production) build, stop before bundling if any of the owner's words are still TODO_OWNER. */
function contentGuard(strict: boolean): Plugin {
  return {
    name: 'winterlight-content-guard',
    apply: 'build',
    buildStart() {
      if (!strict) return;
      const read = (f: string) => readFileSync(new URL(`./content/${f}`, import.meta.url), 'utf8');
      assertContent({ letter: read('letter.md'), wishes: read('wishes.json'), names: read('names.json'), credits: read('credits.json') }, true);
    },
  };
}

export default defineConfig(({ mode }) => {
  // '' prefix: also sees Vercel's own variables (VERCEL_ENV). Only the two values below are ever put into the bundle.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  const strict = isStrictEnv(env);
  const repositoryName = env.GITHUB_REPOSITORY?.split('/')[1];
  const base = env.GITHUB_ACTIONS === 'true' && repositoryName ? `/${repositoryName}/` : '/';
  const key = env.VITE_PREVIEW_KEY;
  if (key && key.length < MIN_PREVIEW_KEY_LENGTH) {
    console.warn(`[winterlight] VITE_PREVIEW_KEY is shorter than ${MIN_PREVIEW_KEY_LENGTH} characters, so preview mode is OFF. Use a long random string.`);
  }
  return {
    base,
    define: {
      __STRICT_CONTENT__: JSON.stringify(strict),
      __PREVIEW_KEY_HASH__: JSON.stringify(previewHashFor(key)),
    },
    plugins: [contentGuard(strict)],
    build: { target: 'es2022', chunkSizeWarningLimit: 900 },
    test: { include: ['tests/**/*.test.ts'], environment: 'node' },
  };
});
