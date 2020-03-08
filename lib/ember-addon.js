var crypto = require('crypto');
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
      return mergeTrees([tree, new rails(tree, options)]);
    } else {
      return tree;
    }
  },

  // Build RubyGem using final directory
  postBuild: function(result) {
    var directory = result.directory;
    var opts = this.railsOptions;
    var paths = opts.outputPaths;

    var meta = help.getPackageMeta(opts.pkg.name, opts);
    fs.mkdirSync(path.join(directory, "/assets/" + meta.id));

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

    options.outputPaths = appOptions.outputPaths;
    this.railsOptions = options;
  },

  _initializePaths: function (appOptions) {
    var opts = this.railsOptions;
    var paths = appOptions.outputPaths;

    var meta = help.getPackageMeta(opts.pkg.name, opts);
    var appDir = "/assets/" + meta.id;

    var packagePaths = opts.packagePaths = {};
    ["app", "vendor"].forEach(function(dir) {
      ["js", "css"].forEach(function(type) {
        if(!paths[dir] || !paths[dir][type]) {
          return;
        }

        var typePaths = paths[dir][type];
        if(typeof typePaths === 'string') {
          typePaths = { app: typePaths }
        };

        for (var key in typePaths) {
          var typePath = typePaths[key];
          var dst = path.join(appDir, path.basename(typePath));
          packagePaths[typePath] = dst;
        }
      });
    });
  }
}
