const fs = require("fs");
const path = require('path');
const fse = require("fs-extra");
const helpers = require('./helpers');
const Handlebars = require("handlebars");
const brocPlugin = require('broccoli-plugin');
const brocHelper = require("broccoli-kitchen-sink-helpers");

const getFilesRecursively = (dir, globPatterns) => {
  return brocHelper.multiGlob(globPatterns, { cwd: dir });
};

class AssetPackager extends brocPlugin {
  constructor(inTree, options) {
    super([inTree]);

    // Process constructor options
    this.inTree = inTree;
    options = options || {};
    this.pkg = options.pkg || {};
    this.project = { pkg: this.pkg };

    // Application's rootURL as asset subpath
    const subpath = options._appRootURL || '';

    // Compute package ID and package Class
    const pkgName = this.pkg.name || 'unknown';
    const pkgMeta = helpers.getPackageMeta(pkgName, options);
    this.railsLayoutPath = `${pkgMeta.path}/boot.erb`;
    this.project.pkgPath = pkgMeta.path + subpath;
    this.project.pkgClass = pkgMeta.class;
    this.project.pkgId = pkgMeta.id;
    this.project.pkgName = pkgName;
  }

  build() {
    const { railsLayoutPath, outputPath: destDir, inputPaths: srcDirs, project } = this;

    // Render RubyGem template files into ./dist
    const tmplDir = path.join(__dirname, "../templates");
    getFilesRecursively(tmplDir, [ "**/*" ]).forEach((file) => {
      const srcFile = path.join(tmplDir, file);
      if(fs.statSync(srcFile).isFile()) {
        const dstFile = path.join(destDir, file);
        let content = fs.readFileSync(srcFile, { encoding: 'utf-8' });

        content = Handlebars.compile(content)(project);
        fse.mkdirpSync(path.dirname(dstFile));
        fs.writeFileSync(dstFile, content);
      }
    });

    // Copy and convert index.html into layout index.erb
    // See also addon's contentFor for placeholder generation
    for (const srcDir of srcDirs) {
      const srcPath = path.join(srcDir, 'index.html');
      if(fs.existsSync(srcPath)) {
        const indexRE = /<!--\s+content-for:(\S*)\s+-->/mg;
        let indexHTML = fs.readFileSync(srcPath).toString();
        indexHTML = indexHTML.replace(indexRE, (_, id) => {
          const blockSym = id == 'body'? '' : `:'${id}' `;
          return `<%= yield ${blockSym}%>`;
        })

        const toPath = path.join(destDir, 'app/views/layouts/', railsLayoutPath);
        fse.emptyDirSync(path.dirname(toPath));
        fs.writeFileSync(toPath, indexHTML);
      }
    }

    // Rename ember-app.* to pkg-name.* for Gemfile autoload
    if(!project.pkg.name) {
      console.log("Could not rename ember-app.rb");
    } else {
      const toFile = path.join(destDir, 'lib', `${project.pkgId}.rb`);
      fs.renameSync(path.join(destDir, 'lib', 'ember-app.rb'), toFile);
      const toTask = path.join(destDir, 'lib', `${project.pkgId}.rake`);
      fs.renameSync(path.join(destDir, 'lib', 'ember-app.rake'), toTask);
    }
  }
}

module.exports = AssetPackager;
