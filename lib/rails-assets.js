var fs = require("fs");
var path = require('path');
var mustache = require("mustache");
var brocWriter = require("broccoli-writer");
var helpers = require("broccoli-kitchen-sink-helpers");

var AssetPackager = function AssetPackager(inTree, options) {
  if (!(this instanceof AssetPackager)) {
    return new AssetPackager(inTree, options);
  }

  this.inTree = inTree;
  options = options || {};
  this.project = options.project || {};
  console.log("LALALALALALALLALALALAL");
  console.log(this.project);  
};

AssetPackager.prototype = Object.create(brocWriter.prototype);
AssetPackager.prototype.constructor = AssetPackager;
AssetPackager.prototype.write = function(readTree, destDir) {
  var projectData = this.project;
  return readTree(this.inTree).then(function (srcDir) {
    // Render RubyGem template files into ./dist
    var tmplDir = path.join(__dirname, "../templates");
    console.log("Inserting wrapper files from", tmplDir)

    getFilesRecursively(tmplDir, [ "**/*" ]).forEach(function (file) {
      var srcFile = path.join(tmplDir, file);
      var dstFile = path.join(destDir, file);
      var content = fs.readFileSync(srcFile, { encoding: 'utf-8' });

      console.log(this.project);
      console.log(projectData);
      content = mustache.render(content, projectData);
      fs.writeFileSync(dstFile, content);
    });

    //console.log("BOOOYAAAAAA: ")
    //console.log(srcDir)
    //console.log("-------------")
    //getFilesRecursively(srcDir, [ "**/*" ]).forEach(function (file) {
    //  var srcFile = path.join(srcDir, file);
    //  console.log(srcFile);
    //});
  });
};

function getFilesRecursively(dir, globPatterns) {
  return helpers.multiGlob(globPatterns, { cwd: dir });
}

module.exports = AssetPackager;
