const path = require('path');
const normalizePath = require('normalize-path');
const SilentError = require('silent-error');
const help = require('./helpers');

const NO_ASSET_REV = 'Skipping ember-cli-rails when broccoli-asset-rev is disabled';

// Resolve peer dependencies from the consuming app's context, not the addon's
const appRequire = (app, mod) => require(require.resolve(mod, { paths: [app.project.root] }));

module.exports = {
  name: 'ember-cli-rails',

  // Vite plugin for gem packaging (used in vite.config.mjs)
  vitePlugin(options) {
    return require('./vite-plugin')(options);
  },

  // Override configuration and build paths
  included(app) {
    this._super.included.apply(this, arguments);
    this._initializeOptions(app.options);
  },

  // Inject content placeholders replaced for ERB
  contentFor(type) {
    if (type === 'app-boot' || type === 'config-module') {
      return ''; // Embroider-only, not from index.html
    } else {
      return `<!-- content-for:${type} -->`;
    }
  },

  /**
   * This function is *not* called by ember-cli directly, but supposed to be imported
   * by an app to wrap the app's Ember build. This workaround is currently needed for
   * Embroider-based builds to merge our tree and tweak publicAssetURL.
   */
  embroiderBuild(app, options) {
    const self = app.project.addons.find(({ name }) => name === 'ember-cli-rails');
    if (!self) throw new Error("Could not find ember-cli-rails dependency.");
    const opts = Object.assign({ packagerOptions: {} }, options);
    const railsOpts = self.railsOptions;

    // Update publicAssetURL to include meta.path
    if(railsOpts.enabled) {
      const meta = help.getPackageMeta(railsOpts.pkg.name, railsOpts);
      const pubURL = (opts.packagerOptions.publicAssetURL || railsOpts.prepend || "").replace(/\/$/, "");
      opts.packagerOptions.publicAssetURL = `${pubURL}/${meta.path}${railsOpts._appRootURL}/`;
    }

    // Allows to modify tree after Embroider build
    const { postprocessAppTree } = opts;
    delete opts['postprocessAppTree'];

    // Run Embroider build and apply tree changes
    const { Webpack } = appRequire(app, '@embroider/webpack');
    let tree = appRequire(app, '@embroider/compat').compatBuild(app, Webpack, opts);
    tree = postprocessAppTree ? postprocessAppTree(tree) : tree;
    return tree;
  },

  // Build RubyGem from ember-app.gemspec
  postBuild(result) {
    if(!this.railsOptions.enabled) return;
    help.packageGem(path.resolve(result.directory), this.railsOptions);
  },

  ////////////// PRIVATE ////////////////
  _initializeOptions(appOptions) {
    const isProd = this.app.env === 'production';
    const options = (appOptions.emberRails ||= {});
    const project = appOptions.project;

    // Resolve rootURL directly from project config, avoiding any
    // dependency on config() hook ordering (ember-cli 6.12+ compat)
    const rootURL = normalizePath(project.config(this.app.env).rootURL || '/');
    const _appRootURL = rootURL === '/' ? '' : rootURL;

    // Skip when Vite plugin handles gem packaging
    const isVite = !!process.env.EMBER_CLI_RAILS_VITE;

    // Defaults overridden by project options below
    const defaultOptions = {
      enabled: !isVite,
      id: "ember-{{ name }}",
      pkg: project.pkg,
      project: project,
      _appRootURL,
    };

    for (const option in defaultOptions) {
      if (!Object.prototype.hasOwnProperty.call(options, option)) {
        options[option] = defaultOptions[option];
      }
    }

    // Skip when Vite plugin handles gem packaging
    if(options.enabled && isVite) {
      throw new SilentError(
        "When building with Vite, the classic ember-cli-rails pipeline is not supported.\n" +
        "Remove the emberRails configuration from ember-cli-build.js and use the\n" +
        "Vite plugin in vite.config.mjs instead."
      );
    }

    // Ensure that we have autoImport configuration
    appOptions.autoImport = appOptions.autoImport || {};

    // Let's RAILZIFY!!!
    if(options.enabled) {
      // Fingerprinting with broccoli-asset-rev
      const fingerprint = appOptions.fingerprint || {};
      if(!fingerprint.enabled && !isProd) {
        console.warn(NO_ASSET_REV);
        options.enabled = false;
      } else {
        // Rails engine will put all assets under meta.pkgPath subdirectory
        const prepend = (fingerprint.prepend || options.prepend || "").replace(/\/$/, "");
        const meta = help.getPackageMeta(options.pkg.name, options);
        fingerprint.prepend = `${prepend}/${meta.path}/`;

        // Rails engine will put all chunks under meta.pkgPath subdirectory as well
        const pubURL = (appOptions.autoImport.publicAssetURL || options.prepend || "").replace(/\/$/, "");
        appOptions.autoImport.publicAssetURL = `${pubURL}/${meta.path}${options._appRootURL}/assets`;

        // Update asset-rev configuration
        appOptions.fingerprint = fingerprint;
      }
    }

    this.railsOptions = options;
  }
};
