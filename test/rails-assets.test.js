const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Mock broccoli-plugin before requiring AssetPackager
const bpPath = require.resolve('broccoli-plugin');
require.cache[bpPath] = {
  id: bpPath, filename: bpPath, loaded: true,
  exports: class FakePlugin {},
};

const AssetPackager = require('../lib/rails-assets');

// Helper: create temp dirs for build tests
const makeTmpDirs = () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ecr-test-'));
  const inputDir = path.join(base, 'input');
  const outputDir = path.join(base, 'output');
  fs.mkdirSync(inputDir);
  fs.mkdirSync(outputDir);
  return { base, inputDir, outputDir };
};

// Helper: create an AssetPackager with inputPaths/outputPath set
const buildPackager = (opts, dirs) => {
  const p = new AssetPackager('fake', opts);
  p.inputPaths = [dirs.inputDir];
  p.outputPath = dirs.outputDir;
  return p;
};

// Helper: build with optional index.html content, returns dirs
const buildWithHtml = (opts, html) => {
  const dirs = makeTmpDirs();
  if (html !== undefined) {
    fs.writeFileSync(path.join(dirs.inputDir, 'index.html'), html);
  }
  buildPackager(opts, dirs).build();
  return dirs;
};

describe('AssetPackager', () => {
  let dirs;
  let mocks = [];

  const mockFn = (obj, method, fn) => {
    const m = mock.method(obj, method, fn);
    mocks.push(m);
    return m;
  };

  afterEach(() => {
    mocks.forEach((m) => m.mock.restore());
    mocks = [];
    if (dirs) fs.rmSync(dirs.base, { recursive: true, force: true });
    dirs = null;
  });

  // --- Constructor ---

  describe('constructor', () => {
    it('requires new keyword (ES class)', () => {
      assert.throws(() => AssetPackager('fake', { pkg: { name: 'app' } }), TypeError);
    });

    it('sets railsLayoutPath from package name', () => {
      const p = new AssetPackager('fake', { pkg: { name: 'my-app' } });
      assert.equal(p.railsLayoutPath, 'my_app/boot.erb');
    });

    it('sets project.pkgPath with _appRootURL subpath', () => {
      const p = new AssetPackager('fake', { pkg: { name: 'my-app' }, _appRootURL: '/sub' });
      assert.equal(p.project.pkgPath, 'my_app/sub');
    });

    it('sets project.pkgPath without subpath when _appRootURL is empty', () => {
      const p = new AssetPackager('fake', { pkg: { name: 'my-app' } });
      assert.equal(p.project.pkgPath, 'my_app');
    });

    it('sets project.pkgClass to PascalCase', () => {
      const p = new AssetPackager('fake', { pkg: { name: 'my-app' } });
      assert.equal(p.project.pkgClass, 'MyApp');
    });

    it('sets project.pkgId', () => {
      const p = new AssetPackager('fake', { pkg: { name: 'my-app' } });
      assert.equal(p.project.pkgId, 'my-app');
    });

    it('sets project.pkgName', () => {
      const p = new AssetPackager('fake', { pkg: { name: 'my-app' } });
      assert.equal(p.project.pkgName, 'my-app');
    });

    it('defaults pkg to empty object when options omitted', () => {
      const p = new AssetPackager('fake');
      assert.deepEqual(p.project.pkg, {});
    });

    it('uses "unknown" for pkgName when pkg.name is falsy', () => {
      const p = new AssetPackager('fake', { pkg: {} });
      assert.equal(p.project.pkgName, 'unknown');
    });

    it('applies custom id template', () => {
      const p = new AssetPackager('fake', { pkg: { name: 'chat' }, id: 'ember-{{ name }}' });
      assert.equal(p.project.pkgId, 'ember-chat');
      assert.equal(p.railsLayoutPath, 'ember_chat/boot.erb');
    });
  });

  // --- build(): template rendering ---

  describe('build() template rendering', () => {
    it('renders gemspec with project metadata', () => {
      dirs = buildWithHtml({
        pkg: { name: 'my-app', version: '1.2.3', author: 'Test', homepage: 'https://example.com', license: 'MIT' },
      });

      const gemspec = fs.readFileSync(path.join(dirs.outputDir, 'ember-app.gemspec'), 'utf-8');
      assert.ok(gemspec.includes('"my-app"'), 'gemspec contains pkgId');
      assert.ok(gemspec.includes('"1.2.3"'), 'gemspec contains version');
      assert.ok(gemspec.includes('"Test"'), 'gemspec contains author');
      assert.ok(gemspec.includes('"https://example.com"'), 'gemspec contains homepage');
      assert.ok(gemspec.includes('"MIT"'), 'gemspec contains license');
    });

    it('renders ember-app.rb with pkgClass and pkgPath', () => {
      dirs = buildWithHtml({ pkg: { name: 'my-app' } });

      const rb = fs.readFileSync(path.join(dirs.outputDir, 'lib', 'my-app.rb'), 'utf-8');
      assert.ok(rb.includes('module MyApp'), 'contains module name');
      assert.ok(rb.includes("AppPath = 'my_app'"), 'contains app path');
    });

    it('renders ember-app.rake with pkgClass and pkgPath', () => {
      dirs = buildWithHtml({ pkg: { name: 'my-app' } });

      const rake = fs.readFileSync(path.join(dirs.outputDir, 'lib', 'my-app.rake'), 'utf-8');
      assert.ok(rake.includes('"prepare_MyApp"'), 'contains task name');
      assert.ok(rake.includes("'my_app'"), 'contains app path');
    });
  });

  // --- build(): index.html → ERB conversion ---

  describe('build() index.html to ERB', () => {
    const readLayout = (outputDir, pkgPath) =>
      fs.readFileSync(path.join(outputDir, 'app/views/layouts', pkgPath, 'boot.erb'), 'utf-8');

    it('converts body content-for to yield', () => {
      dirs = buildWithHtml({ pkg: { name: 'my-app' } }, '<!-- content-for:body -->');
      assert.equal(readLayout(dirs.outputDir, 'my_app'), '<%= yield %>');
    });

    it('converts head content-for to named yield', () => {
      dirs = buildWithHtml({ pkg: { name: 'my-app' } }, '<!-- content-for:head -->');
      assert.equal(readLayout(dirs.outputDir, 'my_app'), "<%= yield :'head' %>");
    });

    it('converts multiple placeholders', () => {
      dirs = buildWithHtml({ pkg: { name: 'my-app' } },
        '<html><!-- content-for:head --><body><!-- content-for:body --></body></html>');

      const erb = readLayout(dirs.outputDir, 'my_app');
      assert.ok(erb.includes("<%= yield :'head' %>"), 'has head yield');
      assert.ok(erb.includes('<%= yield %>'), 'has body yield');
      assert.ok(erb.includes('<html>'), 'preserves surrounding HTML');
    });

    it('preserves non-placeholder HTML', () => {
      dirs = buildWithHtml({ pkg: { name: 'my-app' } }, '<div>hello</div>');
      assert.equal(readLayout(dirs.outputDir, 'my_app'), '<div>hello</div>');
    });

    it('writes layout to correct path based on package', () => {
      dirs = buildWithHtml({ pkg: { name: 'cool-app' } }, 'test');
      const layoutPath = path.join(dirs.outputDir, 'app/views/layouts/cool_app/boot.erb');
      assert.ok(fs.existsSync(layoutPath), 'layout file exists at expected path');
    });

    it('does not create layout when no index.html exists', () => {
      dirs = buildWithHtml({ pkg: { name: 'my-app' } });
      const layoutDir = path.join(dirs.outputDir, 'app/views/layouts');
      assert.ok(!fs.existsSync(layoutDir), 'no layout directory created');
    });

    it('converts custom content-for types', () => {
      dirs = buildWithHtml({ pkg: { name: 'my-app' } }, '<!-- content-for:head-footer -->');
      assert.equal(readLayout(dirs.outputDir, 'my_app'), "<%= yield :'head-footer' %>");
    });
  });

  // --- build(): file renaming ---

  describe('build() file renaming', () => {
    it('renames ember-app.rb to pkgId.rb', () => {
      dirs = buildWithHtml({ pkg: { name: 'my-app' } });
      assert.ok(fs.existsSync(path.join(dirs.outputDir, 'lib', 'my-app.rb')), 'renamed .rb exists');
      assert.ok(!fs.existsSync(path.join(dirs.outputDir, 'lib', 'ember-app.rb')), 'original .rb removed');
    });

    it('renames ember-app.rake to pkgId.rake', () => {
      dirs = buildWithHtml({ pkg: { name: 'my-app' } });
      assert.ok(fs.existsSync(path.join(dirs.outputDir, 'lib', 'my-app.rake')), 'renamed .rake exists');
      assert.ok(!fs.existsSync(path.join(dirs.outputDir, 'lib', 'ember-app.rake')), 'original .rake removed');
    });

    it('logs warning and skips rename when pkg.name is missing', () => {
      const logMock = mockFn(console, 'log', () => {});
      dirs = buildWithHtml({ pkg: {} });

      const called = logMock.mock.calls.some((c) => c.arguments[0] === 'Could not rename ember-app.rb');
      assert.ok(called, 'logs warning about rename');
      assert.ok(fs.existsSync(path.join(dirs.outputDir, 'lib', 'ember-app.rb')), 'original .rb still exists');
    });

    it('uses custom id template for renamed files', () => {
      dirs = buildWithHtml({ pkg: { name: 'chat' }, id: 'ember-{{ name }}' });
      assert.ok(fs.existsSync(path.join(dirs.outputDir, 'lib', 'ember-chat.rb')));
      assert.ok(fs.existsSync(path.join(dirs.outputDir, 'lib', 'ember-chat.rake')));
    });
  });

  // --- build(): full integration ---

  describe('build() integration', () => {
    it('produces complete output for typical config', () => {
      dirs = buildWithHtml(
        { pkg: { name: 'my-app', version: '2.0.0', author: 'Dev', homepage: '', license: 'MIT' } },
        '<!DOCTYPE html><html><!-- content-for:head --><body><!-- content-for:body --></body></html>',
      );

      assert.ok(fs.existsSync(path.join(dirs.outputDir, 'ember-app.gemspec')));
      assert.ok(fs.existsSync(path.join(dirs.outputDir, 'lib', 'my-app.rb')));
      assert.ok(fs.existsSync(path.join(dirs.outputDir, 'lib', 'my-app.rake')));

      const erb = fs.readFileSync(path.join(dirs.outputDir, 'app/views/layouts/my_app/boot.erb'), 'utf-8');
      assert.ok(erb.includes("<%= yield :'head' %>"));
      assert.ok(erb.includes('<%= yield %>'));

      const gemspec = fs.readFileSync(path.join(dirs.outputDir, 'ember-app.gemspec'), 'utf-8');
      assert.ok(gemspec.includes('"my-app"'));
      assert.ok(gemspec.includes('"2.0.0"'));
    });
  });
});
