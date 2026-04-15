const fs = require('fs');
const path = require('path');
const SilentError = require('silent-error');
const helpers = require('./helpers');

/**
 * Vite plugin for ember-cli-rails gem packaging.
 *
 * Runs after Vite writes dist/ — renders gem templates, converts
 * index.html to ERB layout, creates dist-rails/ structure, and
 * runs `gem build`.
 *
 * @param {object} options
 * @param {string} options.id - Handlebars template for gem ID (default: "ember-{{ name }}")
 * @param {string} [options.rootURL] - App rootURL (default: "/")
 */
module.exports = function railsPlugin(options = {}) {
  let outDir;
  let command;
  let railsOptions;

  return {
    name: 'ember-cli-rails',
    apply: 'build',

    // Set Vite's base so asset URLs include the Rails engine prefix
    config(config, env) {
      const isProd = env.mode === 'production';
      options = { enabled: isProd, ...options };
      if (!options.enabled) return;

      if (config.base && config.base !== '/' && config.base !== './') {
        throw new SilentError(
          'ember-cli-rails: "base" must not be set in Vite config.\n' +
          'The ember-cli-rails plugin manages "base" automatically to match ' +
          'the Rails engine asset path. Use the "prepend" option instead:\n' +
          '  railsPlugin({ prepend: "https://cdn.example.com" })'
        );
      }

      const root = config.root || process.cwd();
      const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));

      // Destructure rootURL out so it doesn't leak into getPackageMeta
      // (where it would override the id-based path calculation)
      const { rootURL: optRootURL, ...fwdOptions } = options;
      const _appRootURL = (optRootURL || '').replace(/\/$/, '');

      // Plugin options (mind the order)
      railsOptions = {
        id: 'ember-{{ name }}',
        ...fwdOptions,
        _appRootURL,
        pkg,
      };

      const meta = helpers.getPackageMeta(pkg.name, railsOptions);
      const prepend = (fwdOptions.prepend || '').replace(/\/$/, '');
      return { base: `${prepend}/${meta.path}${_appRootURL}/` };
    },

    configResolved(config) {
      if (!options.enabled) return;

      outDir = config.build.outDir || 'dist';
      command = config.command;

      // Skip packaging in postBuild()
      process.env.EMBER_CLI_RAILS_VITE = '1';
    },

    closeBundle() {
      if (!options.enabled || command !== 'build') return;

      const distDir = path.resolve(outDir);
      if (!fs.existsSync(distDir)) return;

      helpers.packageGem(distDir, railsOptions);
    },
  };
};
