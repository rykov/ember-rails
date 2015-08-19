var path = require('path');
var fs   = require('fs');
var mergeTrees = require('broccoli-merge-trees');
var funnel = require('broccoli-funnel');
var rails = require('./rails-assets');

module.exports = {
  name: 'ember-rails',
  
  included: function (app) {
    this.app = app;
    this.initializeOptions();
  },
  
  initializeOptions: function () {
    var options = this.app.options.emberRails || {};
    var project = this.app.options.project;

    var defaultOptions = {
      enabled: true,
      project: project,
    }

    for (var option in defaultOptions) {
      if (!options.hasOwnProperty(option)) {
        options[option] = defaultOptions[option];
      }
    }

    this.railsOptions = options;
  },  

  postprocessTree: function (type, tree) {
    var options = this.railsOptions;
    if(type === 'all' && options.enabled) {
      return mergeTrees([tree, rails(tree, options)]);
    } else {
      return tree;
    } 
  },

  treeFor: function() {}
}
