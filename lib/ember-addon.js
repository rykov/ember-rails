var path = require('path');
var fs   = require('fs');
var mergeTrees = require('broccoli-merge-trees');
var childProc = require('child_process');
var rails = require('./rails-assets');
var help = require('./helpers');

module.exports = {
  name: 'ember-rails',

  // Override configuration and build paths
  included: function (app) {
    this._super.included.apply(this, arguments);
    this._initializeOptions(app.options);
    this._initializePaths(app.options);
  },

  // Add RubyGem package gemspec and wrapper
  postprocessTree: function (type, tree) {
    var options = this.railsOptions;
    if(type === 'all' && options.enabled) {
      return mergeTrees([tree, rails(tree, options)]);
    } else {
      return tree;
    }
  },

  // Build RubyGem using final directory
  postBuild: function(result) {
    // Build RubyGem from ember-app.gemspec
    var gemCmd = 'gem build ember-app.gemspec';
    console.log(childProc.execSync(gemCmd, {
      timeout: 10000, encoding: 'utf-8',
      cwd: result.directory,
    }));
  },

  ////////////// PRIVATE ////////////////
  _initializeOptions: function (appOptions) {
    var options = appOptions.emberRails || {};
    var project = appOptions.project;

    var defaultOptions = {
      idPrefix: "ember-rails-",
      pkg: project.pkg,
      project: project,
      enabled: true,
    }

    for (var option in defaultOptions) {
      if (!options.hasOwnProperty(option)) {
        options[option] = defaultOptions[option];
      }
    }

    if(options.enabled) {
      appOptions.storeConfigInMeta = false;
      appOptions.fingerprint = appOptions.fingerprint || {};
      appOptions.fingerprint.enabled = false;
    }

    this.railsOptions = options;
  },

  _initializePaths: function (appOptions) {
    var opts = this.railsOptions;
    var paths = appOptions.outputPaths;
    var meta = help.getPackageMeta(opts.pkg.name, opts.idPrefix)

    var appDir = "/assets/" + meta.id;
    paths.app.js      = appDir + '/application.js'
    paths.app.css.app = appDir + '/application.css'
    paths.vendor.css  = appDir + '/vendor.css'
    paths.vendor.js   = appDir + '/vendor.js'
  }
}
