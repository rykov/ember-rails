var { describe, it, afterEach, mock } = require('node:test');
var assert = require('node:assert/strict');
var fs = require('node:fs');
var path = require('node:path');
var os = require('node:os');
var childProc = require('child_process');

var addon = require('../lib/ember-addon');

// --- contentFor ---

describe('contentFor', function () {
  it('returns empty string for app-boot', function () {
    assert.equal(addon.contentFor('app-boot'), '');
  });

  it('returns empty string for config-module', function () {
    assert.equal(addon.contentFor('config-module'), '');
  });

  it('returns placeholder for body', function () {
    assert.equal(addon.contentFor('body'), '<!-- content-for:body -->');
  });

  it('returns placeholder for head', function () {
    assert.equal(addon.contentFor('head'), '<!-- content-for:head -->');
  });

  it('returns placeholder for head-footer', function () {
    assert.equal(addon.contentFor('head-footer'), '<!-- content-for:head-footer -->');
  });

  it('returns placeholder for arbitrary type', function () {
    assert.equal(addon.contentFor('custom-section'), '<!-- content-for:custom-section -->');
  });
});

// --- config ---

describe('config', function () {
  function callConfig(rootURL) {
    var ctx = {};
    addon.config.call(ctx, 'development', rootURL !== undefined ? { rootURL: rootURL } : {});
    return ctx._appRootURL;
  }

  it('sets _appRootURL from rootURL', function () {
    assert.equal(callConfig('/admin/'), '/admin');
  });

  it('sets _appRootURL to empty when rootURL is /', function () {
    assert.equal(callConfig('/'), '');
  });

  it('sets _appRootURL to empty when rootURL is absent', function () {
    assert.equal(callConfig(undefined), '');
  });

  it('normalizes backslashes in rootURL', function () {
    assert.equal(callConfig('\\admin\\'), '/admin');
  });

  it('preserves rootURL without trailing slash', function () {
    assert.equal(callConfig('/admin'), '/admin');
  });
});

// --- _initializeOptions ---

describe('_initializeOptions', function () {
  var mocks = [];

  function mockFn(obj, method, fn) {
    var m = mock.method(obj, method, fn);
    mocks.push(m);
    return m;
  }

  afterEach(function () {
    mocks.forEach(function (m) { m.mock.restore(); });
    mocks = [];
  });

  function makeContext(env, appRootURL) {
    return {
      _appRootURL: appRootURL || '',
      app: { env: env || 'development' },
    };
  }

  function makeAppOptions(overrides) {
    return Object.assign({ project: { pkg: { name: 'my-app' } } }, overrides);
  }

  it('applies default options when emberRails is absent', function () {
    var ctx = makeContext('development');
    addon._initializeOptions.call(ctx, makeAppOptions({ fingerprint: { enabled: true } }));

    assert.equal(ctx.railsOptions.enabled, true);
    assert.equal(ctx.railsOptions.id, 'ember-{{ name }}');
    assert.equal(ctx.railsOptions.pkg.name, 'my-app');
  });

  it('preserves user-provided emberRails options', function () {
    var ctx = makeContext('development');
    addon._initializeOptions.call(ctx, makeAppOptions({
      emberRails: { id: 'custom-{{ name }}', enabled: true },
      fingerprint: { enabled: true },
    }));

    assert.equal(ctx.railsOptions.id, 'custom-{{ name }}');
  });

  it('does not override existing emberRails properties with defaults', function () {
    var ctx = makeContext('development');
    addon._initializeOptions.call(ctx, makeAppOptions({ emberRails: { enabled: false } }));

    assert.equal(ctx.railsOptions.enabled, false);
  });

  it('disables when fingerprint.enabled is false and not production', function () {
    var warnMock = mockFn(console, 'warn', function () {});
    var ctx = makeContext('development');
    addon._initializeOptions.call(ctx, makeAppOptions({ fingerprint: { enabled: false } }));

    assert.equal(ctx.railsOptions.enabled, false);
    var warned = warnMock.mock.calls.some(function (c) {
      return c.arguments[0].includes('Skipping ember-cli-rails');
    });
    assert.ok(warned, 'console.warn called with skip message');
  });

  it('stays enabled in production even with fingerprint disabled', function () {
    var ctx = makeContext('production');
    addon._initializeOptions.call(ctx, makeAppOptions({ fingerprint: { enabled: false } }));

    assert.equal(ctx.railsOptions.enabled, true);
  });

  it('computes fingerprint.prepend with meta.path', function () {
    var ctx = makeContext('development');
    var appOpts = makeAppOptions({
      fingerprint: { enabled: true, prepend: 'https://cdn.example.com/' },
    });
    addon._initializeOptions.call(ctx, appOpts);

    assert.equal(appOpts.fingerprint.prepend, 'https://cdn.example.com/ember_my_app/');
  });

  it('strips trailing slash from fingerprint.prepend before computing', function () {
    var ctx = makeContext('development');
    var appOpts = makeAppOptions({
      fingerprint: { enabled: true, prepend: 'https://cdn.example.com' },
    });
    addon._initializeOptions.call(ctx, appOpts);

    assert.equal(appOpts.fingerprint.prepend, 'https://cdn.example.com/ember_my_app/');
  });

  it('computes autoImport.publicAssetURL', function () {
    var ctx = makeContext('development', '/admin');
    var appOpts = makeAppOptions({ fingerprint: { enabled: true } });
    addon._initializeOptions.call(ctx, appOpts);

    assert.equal(appOpts.autoImport.publicAssetURL, '/ember_my_app/admin/assets');
  });

  it('creates autoImport if absent', function () {
    var ctx = makeContext('development');
    var appOpts = makeAppOptions({ fingerprint: { enabled: true } });
    assert.equal(appOpts.autoImport, undefined);
    addon._initializeOptions.call(ctx, appOpts);

    assert.ok(appOpts.autoImport, 'autoImport created');
    assert.ok(appOpts.autoImport.publicAssetURL, 'publicAssetURL set');
  });

  it('uses options.prepend as fallback for fingerprint.prepend', function () {
    var ctx = makeContext('development');
    var appOpts = makeAppOptions({
      emberRails: { prepend: 'https://alt.com/' },
      fingerprint: { enabled: true },
    });
    addon._initializeOptions.call(ctx, appOpts);

    assert.ok(appOpts.fingerprint.prepend.startsWith('https://alt.com/'));
  });

  it('uses options.prepend as fallback for autoImport.publicAssetURL', function () {
    var ctx = makeContext('development');
    var appOpts = makeAppOptions({
      emberRails: { prepend: 'https://alt.com/' },
      fingerprint: { enabled: true },
    });
    addon._initializeOptions.call(ctx, appOpts);

    assert.ok(appOpts.autoImport.publicAssetURL.startsWith('https://alt.com/'));
  });

  it('updates appOptions.fingerprint reference', function () {
    var ctx = makeContext('development');
    var appOpts = makeAppOptions({ fingerprint: { enabled: true } });
    addon._initializeOptions.call(ctx, appOpts);

    assert.ok(appOpts.fingerprint.prepend, 'fingerprint.prepend was set');
  });

  it('stores railsOptions on context', function () {
    var ctx = makeContext('development');
    addon._initializeOptions.call(ctx, makeAppOptions({ fingerprint: { enabled: true } }));

    assert.ok(ctx.railsOptions, 'railsOptions stored');
    assert.equal(ctx.railsOptions.pkg.name, 'my-app');
  });
});

// --- postprocessTree ---

describe('postprocessTree', function () {
  it('returns merged tree when type is all and enabled', function () {
    var mergedTree = { merged: true };
    var ctx = {
      railsOptions: { enabled: true },
      _mergeGemTree: function () { return mergedTree; },
    };
    assert.deepEqual(addon.postprocessTree.call(ctx, 'all', { original: true }), mergedTree);
  });

  it('returns original tree when type is not all', function () {
    var originalTree = { original: true };
    var ctx = {
      railsOptions: { enabled: true },
      _mergeGemTree: function () { return { merged: true }; },
    };
    assert.deepEqual(addon.postprocessTree.call(ctx, 'js', originalTree), originalTree);
  });

  it('returns original tree when disabled', function () {
    var originalTree = { original: true };
    var ctx = { railsOptions: { enabled: false } };
    assert.deepEqual(addon.postprocessTree.call(ctx, 'all', originalTree), originalTree);
  });
});

// --- postBuild ---

describe('postBuild', function () {
  var origCwd;
  var tmpDir;
  var mocks = [];

  function mockFn(obj, method, fn) {
    var m = mock.method(obj, method, fn);
    mocks.push(m);
    return m;
  }

  function mockGemBuild() {
    mockFn(childProc, 'spawnSync', function () { return { status: 0 }; });
    mockFn(childProc, 'execSync', function () { return 'built'; });
    mockFn(console, 'log', function () {});
  }

  afterEach(function () {
    mocks.forEach(function (m) { m.mock.restore(); });
    mocks = [];
    if (origCwd) process.chdir(origCwd);
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    origCwd = null;
    tmpDir = null;
  });

  function setupPostBuild() {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecr-postbuild-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);

    // Create a fake build result directory
    var resultDir = path.join(tmpDir, 'build-output');
    fs.mkdirSync(resultDir);
    fs.mkdirSync(path.join(resultDir, 'assets'));
    fs.writeFileSync(path.join(resultDir, 'assets', 'app.js'), 'console.log("app")');
    fs.writeFileSync(path.join(resultDir, 'index.html'), '<html></html>');
    fs.writeFileSync(path.join(resultDir, 'robots.txt'), 'User-agent: *');
    fs.writeFileSync(path.join(resultDir, 'ember-app.gemspec'), 'spec');
    fs.mkdirSync(path.join(resultDir, 'app'));
    fs.writeFileSync(path.join(resultDir, 'app', 'boot.erb'), 'layout');
    fs.mkdirSync(path.join(resultDir, 'lib'));
    fs.writeFileSync(path.join(resultDir, 'lib', 'my-app.rb'), 'ruby');
    fs.writeFileSync(path.join(resultDir, 'lib', 'my-app.rake'), 'rake');

    return { directory: resultDir };
  }

  function runPostBuild(result) {
    addon.postBuild.call({ railsOptions: { enabled: true } }, result);
  }

  it('skips everything when not enabled', function () {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecr-postbuild-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);

    addon.postBuild.call({ railsOptions: { enabled: false } }, { directory: '/nonexistent' });
    assert.ok(!fs.existsSync(path.join(tmpDir, 'dist-rails')), 'dist-rails not created');
  });

  it('creates dist-rails directory', function () {
    mockGemBuild();
    runPostBuild(setupPostBuild());

    assert.ok(fs.existsSync(path.join(tmpDir, 'dist-rails')), 'dist-rails created');
  });

  it('copies build output to dist-rails/public', function () {
    mockGemBuild();
    runPostBuild(setupPostBuild());

    assert.ok(fs.existsSync(path.join(tmpDir, 'dist-rails/public/assets/app.js')), 'assets copied');
  });

  it('removes index.html and robots.txt from public', function () {
    mockGemBuild();
    runPostBuild(setupPostBuild());

    assert.ok(!fs.existsSync(path.join(tmpDir, 'dist-rails/public/index.html')), 'index.html removed');
    assert.ok(!fs.existsSync(path.join(tmpDir, 'dist-rails/public/robots.txt')), 'robots.txt removed');
  });

  it('handles missing index.html and robots.txt gracefully', function () {
    var result = setupPostBuild();
    fs.unlinkSync(path.join(result.directory, 'index.html'));
    fs.unlinkSync(path.join(result.directory, 'robots.txt'));
    mockGemBuild();

    assert.doesNotThrow(function () { runPostBuild(result); });
  });

  it('moves app/, lib/, ember-app.gemspec out of public', function () {
    mockGemBuild();
    runPostBuild(setupPostBuild());

    var distRails = path.join(tmpDir, 'dist-rails');
    assert.ok(fs.existsSync(path.join(distRails, 'app', 'boot.erb')), 'app/ moved to root');
    assert.ok(fs.existsSync(path.join(distRails, 'lib', 'my-app.rb')), 'lib/ moved to root');
    assert.ok(fs.existsSync(path.join(distRails, 'ember-app.gemspec')), 'gemspec moved to root');
    assert.ok(!fs.existsSync(path.join(distRails, 'public', 'app')), 'app/ removed from public');
    assert.ok(!fs.existsSync(path.join(distRails, 'public', 'lib')), 'lib/ removed from public');
    assert.ok(!fs.existsSync(path.join(distRails, 'public', 'ember-app.gemspec')), 'gemspec removed from public');
  });

  it('throws when gem command is not found', function () {
    mockFn(childProc, 'spawnSync', function () { return { status: 1 }; });
    mockFn(console, 'log', function () {});

    assert.throws(function () {
      runPostBuild(setupPostBuild());
    }, { message: 'RubyGems is not installed' });
  });

  it('calls gem build with correct command and cwd', function () {
    mockFn(childProc, 'spawnSync', function () { return { status: 0 }; });
    var execMock = mockFn(childProc, 'execSync', function () { return 'Successfully built'; });
    mockFn(console, 'log', function () {});

    runPostBuild(setupPostBuild());

    assert.equal(execMock.mock.calls.length, 1);
    assert.equal(execMock.mock.calls[0].arguments[0], 'gem build ember-app.gemspec');
    var execOpts = execMock.mock.calls[0].arguments[1];
    assert.equal(execOpts.cwd, path.resolve('./dist-rails'));
    assert.equal(execOpts.timeout, 20000);
    assert.equal(execOpts.encoding, 'utf-8');
  });
});

// --- embroiderBuild ---

describe('embroiderBuild', function () {
  var Module = require('module');
  var origResolve = Module._resolveFilename;
  var fakeWebpackPath = path.join(os.tmpdir(), 'fake-embroider-webpack.js');
  var fakeCompatPath = path.join(os.tmpdir(), 'fake-embroider-compat.js');

  function withEmbroiderMocks(compatBuild, fn) {
    Module._resolveFilename = function (request, parent) {
      if (request === '@embroider/webpack') return fakeWebpackPath;
      if (request === '@embroider/compat') return fakeCompatPath;
      return origResolve.call(this, request, parent);
    };
    require.cache[fakeWebpackPath] = {
      id: fakeWebpackPath, filename: fakeWebpackPath, loaded: true,
      exports: { Webpack: function FakeWebpack() {} },
    };
    require.cache[fakeCompatPath] = {
      id: fakeCompatPath, filename: fakeCompatPath, loaded: true,
      exports: { compatBuild: compatBuild },
    };
    try {
      return fn();
    } finally {
      Module._resolveFilename = origResolve;
      delete require.cache[fakeWebpackPath];
      delete require.cache[fakeCompatPath];
    }
  }

  function makeMockSelf(overrides) {
    return Object.assign({
      name: 'ember-cli-rails',
      _appRootURL: '',
      railsOptions: { enabled: false, pkg: { name: 'my-app' } },
    }, overrides);
  }

  it('throws when addon is not found in project addons', function () {
    assert.throws(function () {
      addon.embroiderBuild({ project: { addons: [] } }, {});
    }, { message: 'Could not find ember-cli-rails dependency.' });
  });

  it('computes publicAssetURL when enabled', function () {
    var mockSelf = makeMockSelf({
      railsOptions: { enabled: true, pkg: { name: 'my-app' }, id: 'ember-{{ name }}' },
      _mergeGemTree: function (tree) { return { merged: true, tree: tree }; },
    });

    withEmbroiderMocks(function () { return { fakeTree: true }; }, function () {
      var result = addon.embroiderBuild(
        { project: { addons: [mockSelf] } },
        { packagerOptions: { publicAssetURL: 'https://cdn.com/' } },
      );
      assert.equal(result.merged, true);
    });
  });

  it('returns tree without merging when disabled', function () {
    var mockSelf = makeMockSelf({
      _mergeGemTree: function () { throw new Error('should not be called'); },
    });

    withEmbroiderMocks(function () { return { fakeTree: true }; }, function () {
      var result = addon.embroiderBuild({ project: { addons: [mockSelf] } }, {});
      assert.deepEqual(result, { fakeTree: true });
    });
  });

  it('calls postprocessAppTree callback when provided', function () {
    var mockSelf = makeMockSelf();

    withEmbroiderMocks(function () { return { original: true }; }, function () {
      var result = addon.embroiderBuild({ project: { addons: [mockSelf] } }, {
        postprocessAppTree: function (tree) {
          return { processed: true, from: tree };
        },
      });
      assert.equal(result.processed, true);
      assert.deepEqual(result.from, { original: true });
    });
  });
});
