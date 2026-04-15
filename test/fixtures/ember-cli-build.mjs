import EmberApp from 'ember-cli/lib/broccoli/ember-app.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const addon = require('ember-cli-rails');

export default async function (defaults) {
  const app = new EmberApp(defaults, {});
  return addon.embroiderBuild(app, {});
}
