const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { Buffer } = require('node:buffer');

const StripSourcemaps = require('../lib/strip-sourcemaps');

describe('StripSourcemaps', () => {
  let tmpDir, inputDir, outputDir;

  // PNG magic bytes followed by a fake sourceMappingURL tail; must pass through untouched
  const pngBytes = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('\n//# sourceMappingURL=fake.map\n'),
  ]);

  const jsWithMidComment = 'var s = "//# sourceMappingURL=inline.map";\nconsole.log(s);\n';

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecr-stripmaps-'));
    inputDir = path.join(tmpDir, 'input');
    outputDir = path.join(tmpDir, 'output');
    fs.mkdirSync(path.join(inputDir, 'sub'), { recursive: true });
    fs.mkdirSync(outputDir);

    fs.writeFileSync(path.join(inputDir, 'a.js'), 'console.log("a");\n//# sourceMappingURL=a.map\n');
    fs.writeFileSync(path.join(inputDir, 'a.map'), '{"version":3}');
    fs.writeFileSync(path.join(inputDir, 'b.css'), 'body{color:red}\n/*# sourceMappingURL=b.css.map */');
    fs.writeFileSync(path.join(inputDir, 'b.css.map'), '{"version":3}');
    fs.writeFileSync(path.join(inputDir, 'sub', 'c.js'), 'console.log("c");\n//# sourceMappingURL=c.map\n');
    fs.writeFileSync(path.join(inputDir, 'sub', 'c.map'), '{"version":3}');
    fs.writeFileSync(path.join(inputDir, 'mid.js'), jsWithMidComment);
    fs.writeFileSync(path.join(inputDir, 'logo.png'), pngBytes);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // Run build() directly with stubbed paths, bypassing a full broccoli Builder;
  // defineProperty is needed to shadow broccoli-plugin's throwing prototype getters
  const runPlugin = (options = {}) => {
    const plugin = Object.create(StripSourcemaps.prototype, {
      inputPaths: { value: [inputDir] },
      outputPath: { value: outputDir },
    });
    plugin.keepMaps = !!options.keepMaps;
    plugin.build();
  };

  const read = (rel) => fs.readFileSync(path.join(outputDir, rel), 'utf8');

  it('drops all *.map files, including nested ones', () => {
    runPlugin();
    for (const rel of ['a.map', 'b.css.map', 'sub/c.map']) {
      assert.ok(!fs.existsSync(path.join(outputDir, rel)), `${rel} should be absent`);
    }
  });

  it('strips trailing sourceMappingURL comments from JS and CSS', () => {
    runPlugin();
    assert.equal(read('a.js'), 'console.log("a");\n');
    assert.equal(read('b.css'), 'body{color:red}\n');
    assert.equal(read('sub/c.js'), 'console.log("c");\n');
  });

  it('leaves mid-file sourceMappingURL occurrences untouched', () => {
    runPlugin();
    assert.equal(read('mid.js'), jsWithMidComment);
  });

  it('copies other files through byte-identical', () => {
    runPlugin();
    assert.deepEqual(fs.readFileSync(path.join(outputDir, 'logo.png')), pngBytes);
  });

  it('follows directory symlinks in the input tree', () => {
    const externalDir = path.join(tmpDir, 'external');
    fs.mkdirSync(externalDir);
    fs.writeFileSync(path.join(externalDir, 'd.js'), 'console.log("d");\n//# sourceMappingURL=d.map\n');
    fs.writeFileSync(path.join(externalDir, 'd.map'), '{"version":3}');
    fs.symlinkSync(externalDir, path.join(inputDir, 'linked'));

    runPlugin();
    assert.equal(read('linked/d.js'), 'console.log("d");\n');
    assert.ok(!fs.existsSync(path.join(outputDir, 'linked/d.map')));
  });

  it('is constructible as a broccoli plugin', () => {
    const plugin = new StripSourcemaps([inputDir]);
    assert.equal(typeof plugin.build, 'function');
    assert.equal(plugin.keepMaps, false);
    assert.equal(new StripSourcemaps([inputDir], { keepMaps: true }).keepMaps, true);
  });

  describe('keepMaps ("hidden" mode)', () => {
    it('keeps *.map files byte-identical', () => {
      runPlugin({ keepMaps: true });
      for (const rel of ['a.map', 'b.css.map', 'sub/c.map']) {
        assert.equal(read(rel), '{"version":3}', `${rel} should be kept`);
      }
    });

    it('still strips trailing sourceMappingURL comments', () => {
      runPlugin({ keepMaps: true });
      assert.equal(read('a.js'), 'console.log("a");\n');
      assert.equal(read('b.css'), 'body{color:red}\n');
      assert.equal(read('mid.js'), jsWithMidComment);
    });
  });
});
