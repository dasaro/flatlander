import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';

function readVersionFromPackageJson(): string {
  try {
    const packageJsonUrl = new URL('./package.json', import.meta.url);
    const packageJson = JSON.parse(readFileSync(packageJsonUrl, 'utf8')) as { version?: string };
    if (typeof packageJson.version === 'string' && packageJson.version.length > 0) {
      return packageJson.version;
    }
  } catch {
    // Keep fallback below.
  }
  return '0.0.0';
}

const appVersion = process.env.npm_package_version ?? readVersionFromPackageJson();

export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
});
