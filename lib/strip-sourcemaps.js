const Plugin = require('broccoli-plugin');
const fse = require('fs-extra');
const path = require('path');

// Trailing sourceMappingURL comment, JS line style or CSS block style
const MAP_COMMENT = /\n?(?:\/\/# sourceMappingURL=\S+|\/\*# sourceMappingURL=\S+\s*\*\/)\s*$/;

// Relative paths of all files under dir, recursing through directories
// (statSync follows symlinks, which broccoli input trees rely on)
const walkFiles = (dir, prefix = '') => {
  const files = [];
  for (const name of fse.readdirSync(dir)) {
    const rel = path.join(prefix, name);
    const full = path.join(dir, name);
    if (fse.statSync(full).isDirectory()) {
      files.push(...walkFiles(full, rel));
    } else {
      files.push(rel);
    }
  }
  return files;
};

// Drops *.map files and strips trailing sourceMappingURL comments from
// .js/.css; everything else is copied through unchanged. With keepMaps
// ("hidden" mode), *.map files pass through and only comments are stripped
module.exports = class StripSourcemaps extends Plugin {
  constructor(inputNodes, options = {}) {
    super(inputNodes, { annotation: 'ember-cli-rails: strip-sourcemaps' });
    this.keepMaps = !!options.keepMaps;
  }

  build() {
    const [inputPath] = this.inputPaths;
    for (const rel of walkFiles(inputPath)) {
      if (!this.keepMaps && rel.endsWith('.map')) continue;
      const src = path.join(inputPath, rel);
      const dest = path.join(this.outputPath, rel);
      if (/\.(js|css)$/.test(rel)) {
        fse.outputFileSync(dest, fse.readFileSync(src, 'utf8').replace(MAP_COMMENT, '\n'));
      } else {
        fse.copySync(src, dest, { dereference: true });
      }
    }
  }
};
