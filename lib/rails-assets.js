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

  // Application's rootURL as asset subpath
  var subpath = options._appRootURL || '';

  // Compute package ID and package Class
  var pkgName = this.pkg.name || 'unknown';
  var pkgMeta = helpers.getPackageMeta(pkgName, options);
  this.railsLayoutPath = pkgMeta.path + '/boot.erb';
  this.project.pkgPath = pkgMeta.path + subpath;
  this.project.pkgClass = pkgMeta.class;
  this.project.pkgId = pkgMeta.id;
  this.project.pkgName = pkgName;
}

AssetPackager.prototype.build = function() {
  var railsLayoutPath = this.railsLayoutPath;
  var destDir = this.outputPath;
  var srcDirs = this.inputPaths;
  var project = this.project;

  return (function (/* srcDir */) {
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

    // Copy and convert index.html into layout index.erb
    // See also addon's contentFor for placeholder generation
    for (var srcDir of srcDirs) {
      var srcPath = path.join(srcDir, 'index.html');
      if(fs.existsSync(srcPath)) {
        var indexRE = /<!--\s+content-for:(\S*)\s+-->/mg;
        var indexHTML = fs.readFileSync(srcPath).toString();
        indexHTML = indexHTML.replace(indexRE, function(_, id) {
          let block_sym = id == 'body'? '' : ':\'' + id + '\' ';
          return '<%= yield ' + block_sym + '%>';
        })

        var toPath = path.join(destDir, 'app/views/layouts/', railsLayoutPath);
        fse.emptyDirSync(path.dirname(toPath));
        fs.writeFileSync(toPath, indexHTML);
      }
    }

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
