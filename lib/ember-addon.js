const path = require('path');
const fse = require('fs-extra');
const mergeTrees = require('broccoli-merge-trees');
const normalizePath = require('normalize-path');
const childProc = require('child_process');
const rails = require('./rails-assets');
const help = require('./helpers');

const NO_ASSET_REV = 'Skipping ember-cli-rails when broccoli-asset-rev is disabled';

module.exports = {
  name: 'ember-cli-rails',

  // Override configuration and build paths
  included(app) {
    this._super.included.apply(this, arguments);
    this._initializeOptions(app.options);
  },

  config(env, baseConfig) {
    this._appRootURL = normalizePath(baseConfig.rootURL || '/');
    if(this._appRootURL === '/') this._appRootURL = '';
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
      opts.packagerOptions.publicAssetURL = `${pubURL}/${meta.path}${self._appRootURL}/`;
    }

    // Allows to modify tree after Embroider build
    const { postprocessAppTree } = opts;
    delete opts['postprocessAppTree'];

    // Run Embroider build and apply tree changes
    const { Webpack } = require('@embroider/webpack');
    let tree = require('@embroider/compat').compatBuild(app, Webpack, opts);
    tree = postprocessAppTree ? postprocessAppTree(tree) : tree;
    return railsOpts.enabled ? self._mergeGemTree(tree) : tree;
  },

  // Add RubyGem package gemspec and wrapper
  postprocessTree(type, tree) {
    const ok = type === 'all' && this.railsOptions.enabled;
    return ok ? this._mergeGemTree(tree) : tree;
  },

  // Add RubyGem package gemspec and wrapper
  _mergeGemTree(tree) {
    const gemTree = new rails(tree, this.railsOptions);
    return mergeTrees([tree, gemTree]);
  },

  // Build RubyGem from ember-app.gemspec
  postBuild(result) {
    if(this.railsOptions.enabled) {
      // Create the root directory for dist-rails
      const dstRoot = path.resolve("./dist-rails");
      fse.emptyDirSync(dstRoot);

      // Copy everything to dist-rails/public
      const srcRoot = path.resolve(result.directory);
      const dstPublic = path.resolve("./dist-rails/public");
      fse.copySync(srcRoot, dstPublic, { dereference: true });

      // Remove unnecessary files from Ember, etc
      ["/index.html", "/robots.txt"].forEach((name) => {
        const p = path.resolve(dstPublic + name);
        if(fse.existsSync(p)) fse.unlinkSync(p);
      });

      // Move ember-rails specific stuff outside
      ["/app", "/lib", "/ember-app.gemspec"].forEach((p) => {
        const fSrc = path.resolve(dstPublic + p);
        const fDst = path.resolve(dstRoot + p);
        fse.moveSync(fSrc, fDst);
      });

      // Verify that "gem" command exists
      const which = process.platform === 'win32' ? 'where' : 'which';
      const wOut = childProc.spawnSync(which, ['gem'], { stdio: 'ignore' });
      if(wOut.status !== 0) throw new Error('RubyGems is not installed');

      // Run "gem build" to create .gem file
      const gemCmd = 'gem build ember-app.gemspec';
      console.log(childProc.execSync(gemCmd, {
        timeout: 20000, encoding: 'utf-8',
        cwd: dstRoot,
      }));

      // Success!
      console.log('Built RubyGem successfully. Stored in "dist-rails/".');
    }
  },

  ////////////// PRIVATE ////////////////
  _initializeOptions(appOptions) {
    const isProd = this.app.env === 'production';
    const options = appOptions.emberRails || {};
    const project = appOptions.project;

    const defaultOptions = {
      _appRootURL: this._appRootURL, // See config()
      enabled: true, // FIXME: Should be isProd
      id: "ember-{{ name }}",
      pkg: project.pkg,
      project: project,
    };

    for (const option in defaultOptions) {
      if (!Object.prototype.hasOwnProperty.call(options, option)) {
        options[option] = defaultOptions[option];
      }
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
        appOptions.autoImport.publicAssetURL = `${pubURL}/${meta.path}${this._appRootURL}/assets`;

        // Update asset-rev configuration
        appOptions.fingerprint = fingerprint;
      }
    }

    this.railsOptions = options;
  }
};
