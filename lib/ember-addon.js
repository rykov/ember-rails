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
      id: "ember-rails-{{ name }}",
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
      var fingerprint = appOptions.fingerprint || {};
      fingerprint.assetMapPath = "assetMap.json";
      fingerprint.generateAssetMap = true;
      appOptions.fingerprint = fingerprint;
      appOptions.storeConfigInMeta = false;
    }

    this.railsOptions = options;
  }
}
