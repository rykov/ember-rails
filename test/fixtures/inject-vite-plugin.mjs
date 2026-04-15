/**
 * Injects the ember-cli-rails Vite plugin into an existing vite.config.mjs.
 * Usage: node inject-vite-plugin.mjs <path-to-vite-config>
 *
 * This avoids hardcoding @embroider/vite imports that vary across versions.
 * Instead, we prepend our import and inject addon.vitePlugin() into the
 * plugins array of whatever config `ember new` generated.
 */
import { readFileSync, writeFileSync } from 'fs';

const configPath = process.argv[2];
if (!configPath) {
  console.error('Usage: node inject-vite-plugin.mjs <vite-config-path>');
  process.exit(1);
}

let content = readFileSync(configPath, 'utf-8');

// Prepend our import
const importBlock = [
  'import { createRequire } from "node:module";',
  'const require = createRequire(import.meta.url);',
  'const railsPlugin = require("ember-cli-rails/vite-plugin");',
  '',
].join('\n');

content = importBlock + content;

// Inject plugin into the plugins array
content = content.replace(/plugins:\s*\[/, 'plugins: [\n    railsPlugin(),');

writeFileSync(configPath, content);
console.log(`Injected ember-cli-rails vite plugin into ${configPath}`);
