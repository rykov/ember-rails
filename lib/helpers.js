const fs = require("fs");
const path = require("path");
const fse = require("fs-extra");
const childProc = require("child_process");
const Handlebars = require("handlebars");

const brocHelper = require("broccoli-kitchen-sink-helpers");
const getFilesRecursively = (dir, globPatterns = ["**/*"]) => {
  return brocHelper.multiGlob(globPatterns, { cwd: dir });
};

// Render gem scaffold (templates, ERB layout, file renames) into destDir.
const renderGemScaffold = (destDir, buildDir, options) => {
  const pkgName = (options.pkg || {}).name || 'unknown';
  const pkgMeta = getPackageMeta(pkgName, options);
  const subpath = options._appRootURL || '';
  const project = {
    pkg: options.pkg,
    pkgPath: pkgMeta.path + subpath,
    pkgClass: pkgMeta.class,
    pkgId: pkgMeta.id,
    pkgName: pkgName,
  };

  // Render Handlebars templates from templates/ into destDir
  const tmplDir = path.join(__dirname, "../templates");
  getFilesRecursively(tmplDir, ["**/*"]).forEach((file) => {
    const srcFile = path.join(tmplDir, file);
    if (fs.statSync(srcFile).isFile()) {
      const dstFile = path.join(destDir, file);
      let content = fs.readFileSync(srcFile, { encoding: 'utf-8' });
      content = Handlebars.compile(content)(project);
      fse.mkdirpSync(path.dirname(dstFile));
      fs.writeFileSync(dstFile, content);
    }
  });

  // Convert index.html from build output into ERB layout
  const indexPath = path.join(buildDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    const indexRE = /<!--\s+content-for:(\S*)\s+-->/mg;
    let indexHTML = fs.readFileSync(indexPath).toString();
    indexHTML = indexHTML.replace(indexRE, (_, id) => {
      const blockSym = id === 'body' ? '' : `:'${id}' `;
      return `<%= yield ${blockSym}%>`;
    });

    const railsLayoutPath = `${pkgMeta.path}/boot.erb`;
    const toPath = path.join(destDir, 'app/views/layouts/', railsLayoutPath);
    fse.mkdirpSync(path.dirname(toPath));
    fs.writeFileSync(toPath, indexHTML);
  }

  // Rename ember-app.* to pkg-name.* for Gemfile autoload
  if (project.pkg && project.pkg.name) {
    const libDir = path.join(destDir, 'lib');
    fs.renameSync(path.join(libDir, 'ember-app.rb'), path.join(libDir, `${project.pkgId}.rb`));
    fs.renameSync(path.join(libDir, 'ember-app.rake'), path.join(libDir, `${project.pkgId}.rake`));
  }
};

// Generate common package metadata
//   return {
//     id:    'ember-app-name',
//     base:  'sanitized-app-name',
//     class: 'EmberRailsAppName',
//     path:  'ember_app_name',
//   }
const getPackageMeta = (name, opts) => {
  const id = opts.id || '{{ name }}';
  const out = { base: name.replace(/[^\w-_]/g, '') };
  out.id = Handlebars.compile(id)({ name: out.base });
  out.path = getPkgPath(out.id, opts.rootURL);
  out.class = getPkgClassName(out.id);
  return out;
};

const getPkgClassName = (name) => {
  name = (name || '').replace(/[\W_]/g, ' ');
  return name.replace(/\b(.)?/g, (m, c) => {
    return c ? c.toUpperCase() : "";
  }).replace(/\s/g, '');
};

const getPkgPath = (id, rootURL) => {
  if(rootURL) {
    return rootURL.replace(/^\/+|\/+$/g, '');
  } else {
    return id.replace(/-/g, "_");
  }
};

module.exports = {
  // Create dist-rails/ structure from build output, generate gem scaffold, and run `gem build`.
  // Throws if RubyGems is not installed or `gem build` fails.
  packageGem(buildDir, options) {
    // Create the root directory for dist-rails
    const dstRoot = path.resolve("dist-rails");
    fse.emptyDirSync(dstRoot);

    // Copy build output to dist-rails/public
    const dstPublic = path.join(dstRoot, "public");
    fse.copySync(buildDir, dstPublic, { dereference: true });

    // Generate gem scaffold (templates, ERB layout, file renames) into dist-rails
    renderGemScaffold(dstRoot, buildDir, options);

    // Remove non-asset files from public
    ["/index.html", "/robots.txt"].forEach((name) => {
      const p = path.join(dstPublic, name);
      if (fse.existsSync(p)) fse.removeSync(p);
    });

    // Verify that "gem" command exists
    const which = process.platform === 'win32' ? 'where' : 'which';
    const wOut = childProc.spawnSync(which, ['gem'], { stdio: 'ignore' });
    if (wOut.status !== 0) throw new Error('RubyGems is not installed');

    // Run "gem build" to create .gem file
    const result = childProc.spawnSync('gem', ['build', 'ember-app.gemspec'], {
      timeout: 20000, encoding: 'utf-8',
      cwd: dstRoot,
    });

    if (result.status !== 0) {
      throw new Error(`gem build failed: ${result.stderr}`);
    }

    console.log(result.stdout);
    console.log('Built RubyGem successfully. Stored in "dist-rails/".');
  },

  getPackageMeta,
};
