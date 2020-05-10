var fs = require("fs");
var path = require('path');
var fse = require("fs-extra");
var helpers = require('./helpers');
var Handlebars = require("handlebars");
var brocPlugin = require('broccoli-plugin');
var brocHelper = require("broccoli-kitchen-sink-helpers");

AssetPackager.prototype = Object.create(brocPlugin.prototype);
AssetPackager.prototype.constructor = AssetPackager;

function AssetPackager(inTree, options) {
  if (!(this instanceof AssetPackager)) {
    return new AssetPackager(inTree, options);
  }

  brocPlugin.call(this, [inTree]);

  // Process constructor options
  this.inTree = inTree;
  options = options || {};
  this.pkg = options.pkg || {};
  this.project = { pkg: this.pkg };

  // Compute package ID and package Class
  var pkgName = this.pkg.name || 'unknown';
  var pkgMeta = helpers.getPackageMeta(pkgName, options);
  this.project.pkgClass = pkgMeta.class;
  this.project.pkgPath = pkgMeta.path;
  this.project.pkgId = pkgMeta.id;
};


AssetPackager.prototype.build = function() {
  var destDir = this.outputPath;
  var project = this.project;

  return (function (srcDir) {
    // Render RubyGem template files into ./dist
    var tmplDir = path.join(__dirname, "../templates");
    getFilesRecursively(tmplDir, [ "**/*" ]).forEach(function (file) {
      var srcFile = path.join(tmplDir, file);
      if(fs.statSync(srcFile).isFile()) {
        var dstFile = path.join(destDir, file);
        var content = fs.readFileSync(srcFile, { encoding: 'utf-8' });

        content = Handlebars.compile(content)(project);
        fse.mkdirpSync(path.dirname(dstFile));
        fs.writeFileSync(dstFile, content);
      }
    });

    // Rename ember-app.* to pkg-name.* for Gemfile autoload
    if(!project.pkg.name) {
      console.log("Could not rename ember-app.rb");
    } else {
      var toFile = path.join(destDir, 'lib', project.pkgId + '.rb');
      fs.renameSync(path.join(destDir, 'lib', 'ember-app.rb'), toFile);
      var toTask = path.join(destDir, 'lib', project.pkgId + '.rake');
      fs.renameSync(path.join(destDir, 'lib', 'ember-app.rake'), toTask);
    }
  })(this.inputPaths[0]);
};

function getFilesRecursively(dir, globPatterns) {
  return brocHelper.multiGlob(globPatterns, { cwd: dir });
}

module.exports = AssetPackager;
