var path = require('path');
var fse = require('fs-extra');
var mergeTrees = require('broccoli-merge-trees');
var normalizePath = require('normalize-path');
var childProc = require('child_process');
var rails = require('./rails-assets');
var help = require('./helpers');

var NO_ASSET_REV = 'Skipping ember-cli-rails when broccoli-asset-rev is disabled';

module.exports = {
  name: 'ember-cli-rails',

  // Override configuration and build paths
  included: function (app) {
    this._super.included.apply(this, arguments);
    this._initializeOptions(app.options);
  },

  config: function(env, baseConfig) {
    this._appRootURL = normalizePath(baseConfig.rootURL || '/');
    if(this._appRootURL === '/') this._appRootURL = '';
  },

  // Inject content placeholders replaced for ERB
  contentFor: function(type) {
    return '<!-- content-for:' + type + ' -->';
  },

  // Add RubyGem package gemspec and wrapper
  postprocessTree: function (type, tree) {
    var options = this.railsOptions;
    if(type === 'all' && options.enabled) {
      return mergeTrees([tree, new rails(tree, options)]);
    } else {
      return tree;
    }
  },

  // Build RubyGem from ember-app.gemspec
  postBuild: function(result) {
    if(this.railsOptions.enabled) {
      // Create the root directory for dist-rails
      let dstRoot = path.resolve("./dist-rails");
      fse.emptyDirSync(dstRoot);

      // Copy everything to dist-rails/public
      let srcRoot = path.resolve(result.directory);
      let dstPublic = path.resolve("./dist-rails/public");
      fse.copySync(srcRoot, dstPublic, { dereference: true });

      // Remove unnecessary files from Ember, etc
      ["/index.html", "/robots.txt"].forEach((name) => {
        const p = path.resolve(dstPublic + name);
        if(fse.existsSync(p)) fse.unlinkSync(p);
      });

      // Move ember-rails specific stuff outside
      ["/app", "/lib", "/ember-app.gemspec"].forEach((p) => {
        let fSrc = path.resolve(dstPublic + p);
        let fDst = path.resolve(dstRoot + p);
        fse.moveSync(fSrc, fDst);
      });

      var gemCmd = 'gem build ember-app.gemspec';
      console.log(childProc.execSync(gemCmd, {
        timeout: 10000, encoding: 'utf-8',
        cwd: dstRoot,
      }));
    }
  },

  ////////////// PRIVATE ////////////////
  _initializeOptions: function (appOptions) {
    var isProd = this.app.env === 'production';
    var options = appOptions.emberRails || {};
    var project = appOptions.project;

    var defaultOptions = {
      _appRootURL: this._appRootURL, // See config()
      enabled: true, // FIXME: Should be isProd
      id: "ember-{{ name }}",
      pkg: project.pkg,
      project: project,
    }

    for (var option in defaultOptions) {
      if (!Object.prototype.hasOwnProperty.call(options, option)) {
        options[option] = defaultOptions[option];
      }
    }

    // Ensure that we have autoImport configuration
    appOptions.autoImport = appOptions.autoImport || {};

    // Let's RAILZIFY!!!
    if(options.enabled) {
      // Fingerprinting with broccoli-asset-rev
      var fingerprint = appOptions.fingerprint || {};
      if(!fingerprint.enabled && !isProd) {
        console.warn(NO_ASSET_REV);
        options.enabled = false;
      } else {
        // Rails engine will put all assets under meta.pkgPath subdirectory
        var prepend = (fingerprint.prepend || options.prepend || "").replace(/\/$/, "");
        var meta = help.getPackageMeta(options.pkg.name, options);
        fingerprint.prepend = prepend + "/" + meta.path + "/";

        // Rails engine will put all chunks under meta.pkgPath subdirectory as well
        var pubURL = (appOptions.autoImport.publicAssetURL || options.prepend || "").replace(/\/$/, "");
        appOptions.autoImport.publicAssetURL = pubURL + "/" + meta.path + this._appRootURL + "/assets";

        // Update asset-rev configuration
        appOptions.fingerprint = fingerprint;
      }
    }

    this.railsOptions = options;
  }
}
