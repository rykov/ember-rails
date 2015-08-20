var fs = require("fs");
var path = require('path');
var mkdirp = require("mkdirp");
var helpers = require('./helpers');
var mustache = require("mustache");
var brocWriter = require("broccoli-writer");
var brocHelper = require("broccoli-kitchen-sink-helpers");


var AssetPackager = function AssetPackager(inTree, options) {
  if (!(this instanceof AssetPackager)) {
    return new AssetPackager(inTree, options);
  }

  // Process constructor options
  this.inTree = inTree;
  options = options || {};
  this.pkg = options.pkg || {};
  this.project = { pkg: this.pkg };

  // Compute package ID and package Class
  var idPrefix = options.idPrefix || '';
  var pkgName = this.pkg.name || 'unknown';
  var pkgMeta = helpers.getPackageMeta(pkgName, idPrefix);
  this.project.pkgClass = pkgMeta.class;
  this.project.pkgId = pkgMeta.id;
};

AssetPackager.prototype = Object.create(brocWriter.prototype);
AssetPackager.prototype.constructor = AssetPackager;
AssetPackager.prototype.write = function(readTree, destDir) {
  var project = this.project;

  return readTree(this.inTree).then(function (srcDir) {
    // Render RubyGem template files into ./dist
    var tmplDir = path.join(__dirname, "../templates");
    getFilesRecursively(tmplDir, [ "**/*" ]).forEach(function (file) {
      var srcFile = path.join(tmplDir, file);
      if(fs.statSync(srcFile).isFile()) {
        var dstFile = path.join(destDir, file);
        var content = fs.readFileSync(srcFile, { encoding: 'utf-8' });

        content = mustache.render(content, project);
        mkdirp.sync(path.dirname(dstFile));
        fs.writeFileSync(dstFile, content);
      }
    });

    // Rename ember-app.rb to pkg-name.rb for Gemfile autoload
    if(!project.pkg.name) { 
      console.log("Could not rename ember-app.rb");
    } else {
      var toFile = path.join(destDir, 'lib', project.pkgId + '.rb');
      fs.renameSync(path.join(destDir, 'lib', 'ember-app.rb'), toFile);
    }
  });
};

function getFilesRecursively(dir, globPatterns) {
  return brocHelper.multiGlob(globPatterns, { cwd: dir });
}

module.exports = AssetPackager;
