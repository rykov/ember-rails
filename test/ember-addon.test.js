const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const childProc = require('child_process');

const addon = require('../lib/ember-addon');

// --- contentFor ---

describe('contentFor', () => {
  it('returns empty string for app-boot', () => {
    assert.equal(addon.contentFor('app-boot'), '');
  });

  it('returns empty string for config-module', () => {
    assert.equal(addon.contentFor('config-module'), '');
  });

  it('returns placeholder for body', () => {
    assert.equal(addon.contentFor('body'), '<!-- content-for:body -->');
  });

  it('returns placeholder for head', () => {
    assert.equal(addon.contentFor('head'), '<!-- content-for:head -->');
  });

  it('returns placeholder for head-footer', () => {
    assert.equal(addon.contentFor('head-footer'), '<!-- content-for:head-footer -->');
  });

  it('returns placeholder for arbitrary type', () => {
    assert.equal(addon.contentFor('custom-section'), '<!-- content-for:custom-section -->');
  });
});

// --- _initializeOptions ---

describe('_initializeOptions', () => {
  let mocks = [];

  const mockFn = (obj, method, fn) => {
    const m = mock.method(obj, method, fn);
    mocks.push(m);
    return m;
  };

  afterEach(() => {
    mocks.forEach((m) => m.mock.restore());
    mocks = [];
  });

  const makeContext = (env) => ({
    app: { env: env || 'development' },
  });

  const makeAppOptions = (overrides) =>
    Object.assign({
      project: {
        pkg: { name: 'my-app' },
        config() { return {}; },
      },
    }, overrides);

  const makeAppOptionsWithRootURL = (rootURL, overrides) =>
    makeAppOptions(Object.assign({
      project: {
        pkg: { name: 'my-app' },
        config() { return { rootURL }; },
      },
    }, overrides));

  it('applies default options when emberRails is absent', () => {
    const ctx = makeContext('development');
    addon._initializeOptions.call(ctx, makeAppOptions({ fingerprint: { enabled: true } }));

    assert.equal(ctx.railsOptions.enabled, true);
    assert.equal(ctx.railsOptions.id, 'ember-{{ name }}');
    assert.equal(ctx.railsOptions.pkg.name, 'my-app');
  });

  it('preserves user-provided emberRails options', () => {
    const ctx = makeContext('development');
    addon._initializeOptions.call(ctx, makeAppOptions({
      emberRails: { id: 'custom-{{ name }}', enabled: true },
      fingerprint: { enabled: true },
    }));

    assert.equal(ctx.railsOptions.id, 'custom-{{ name }}');
  });

  it('does not override existing emberRails properties with defaults', () => {
    const ctx = makeContext('development');
    addon._initializeOptions.call(ctx, makeAppOptions({ emberRails: { enabled: false } }));

    assert.equal(ctx.railsOptions.enabled, false);
  });

  it('disables when fingerprint.enabled is false and not production', () => {
    const warnMock = mockFn(console, 'warn', () => {});
    const ctx = makeContext('development');
    addon._initializeOptions.call(ctx, makeAppOptions({ fingerprint: { enabled: false } }));

    assert.equal(ctx.railsOptions.enabled, false);
    const warned = warnMock.mock.calls.some((c) => c.arguments[0].includes('Skipping ember-cli-rails'));
    assert.ok(warned, 'console.warn called with skip message');
  });

  it('stays enabled in production even with fingerprint disabled', () => {
    const ctx = makeContext('production');
    addon._initializeOptions.call(ctx, makeAppOptions({ fingerprint: { enabled: false } }));

    assert.equal(ctx.railsOptions.enabled, true);
  });

  it('computes fingerprint.prepend with meta.path', () => {
    const ctx = makeContext('development');
    const appOpts = makeAppOptions({
      fingerprint: { enabled: true, prepend: 'https://cdn.example.com/' },
    });
    addon._initializeOptions.call(ctx, appOpts);

    assert.equal(appOpts.fingerprint.prepend, 'https://cdn.example.com/ember_my_app/');
  });

  it('strips trailing slash from fingerprint.prepend before computing', () => {
    const ctx = makeContext('development');
    const appOpts = makeAppOptions({
      fingerprint: { enabled: true, prepend: 'https://cdn.example.com' },
    });
    addon._initializeOptions.call(ctx, appOpts);

    assert.equal(appOpts.fingerprint.prepend, 'https://cdn.example.com/ember_my_app/');
  });

  it('computes autoImport.publicAssetURL', () => {
    const ctx = makeContext('development');
    const appOpts = makeAppOptionsWithRootURL('/admin', { fingerprint: { enabled: true } });
    addon._initializeOptions.call(ctx, appOpts);

    assert.equal(appOpts.autoImport.publicAssetURL, '/ember_my_app/admin/assets');
  });

  it('creates autoImport if absent', () => {
    const ctx = makeContext('development');
    const appOpts = makeAppOptions({ fingerprint: { enabled: true } });
    assert.equal(appOpts.autoImport, undefined);
    addon._initializeOptions.call(ctx, appOpts);

    assert.ok(appOpts.autoImport, 'autoImport created');
    assert.ok(appOpts.autoImport.publicAssetURL, 'publicAssetURL set');
  });

  it('uses options.prepend as fallback for fingerprint.prepend', () => {
    const ctx = makeContext('development');
    const appOpts = makeAppOptions({
      emberRails: { prepend: 'https://alt.com/' },
      fingerprint: { enabled: true },
    });
    addon._initializeOptions.call(ctx, appOpts);

    assert.ok(appOpts.fingerprint.prepend.startsWith('https://alt.com/'));
  });

  it('uses options.prepend as fallback for autoImport.publicAssetURL', () => {
    const ctx = makeContext('development');
    const appOpts = makeAppOptions({
      emberRails: { prepend: 'https://alt.com/' },
      fingerprint: { enabled: true },
    });
    addon._initializeOptions.call(ctx, appOpts);

    assert.ok(appOpts.autoImport.publicAssetURL.startsWith('https://alt.com/'));
  });

  it('updates appOptions.fingerprint reference', () => {
    const ctx = makeContext('development');
    const appOpts = makeAppOptions({ fingerprint: { enabled: true } });
    addon._initializeOptions.call(ctx, appOpts);

    assert.ok(appOpts.fingerprint.prepend, 'fingerprint.prepend was set');
  });

  it('stores railsOptions on context', () => {
    const ctx = makeContext('development');
    addon._initializeOptions.call(ctx, makeAppOptions({ fingerprint: { enabled: true } }));

    assert.ok(ctx.railsOptions, 'railsOptions stored');
    assert.equal(ctx.railsOptions.pkg.name, 'my-app');
  });

  // --- rootURL resolution (ember-cli 6.12+ hook ordering fix) ---

  it('resolves _appRootURL from project.config() rootURL', () => {
    const ctx = makeContext('development');
    addon._initializeOptions.call(ctx, makeAppOptionsWithRootURL('/admin/', { fingerprint: { enabled: true } }));

    assert.equal(ctx.railsOptions._appRootURL, '/admin');
  });

  it('sets _appRootURL to empty when rootURL is /', () => {
    const ctx = makeContext('development');
    addon._initializeOptions.call(ctx, makeAppOptionsWithRootURL('/', { fingerprint: { enabled: true } }));

    assert.equal(ctx.railsOptions._appRootURL, '');
  });

  it('sets _appRootURL to empty when rootURL is absent', () => {
    const ctx = makeContext('development');
    addon._initializeOptions.call(ctx, makeAppOptions({ fingerprint: { enabled: true } }));

    assert.equal(ctx.railsOptions._appRootURL, '');
  });

  it('works when _appRootURL is not pre-set on context (included before config)', () => {
    const ctx = { app: { env: 'development' } };
    addon._initializeOptions.call(ctx, makeAppOptionsWithRootURL('/admin/', { fingerprint: { enabled: true } }));

    assert.equal(ctx.railsOptions._appRootURL, '/admin');
  });

  it('preserves user override of _appRootURL', () => {
    const ctx = makeContext('development');
    const appOpts = makeAppOptionsWithRootURL('/', {
      emberRails: { _appRootURL: '/custom' },
      fingerprint: { enabled: true },
    });
    addon._initializeOptions.call(ctx, appOpts);

    assert.equal(ctx.railsOptions._appRootURL, '/custom');
  });
});

// --- postprocessTree ---

describe('postprocessTree', () => {
  it('returns merged tree when type is all and enabled', () => {
    const mergedTree = { merged: true };
    const ctx = {
      railsOptions: { enabled: true },
      _mergeGemTree() { return mergedTree; },
    };
    assert.deepEqual(addon.postprocessTree.call(ctx, 'all', { original: true }), mergedTree);
  });

  it('returns original tree when type is not all', () => {
    const originalTree = { original: true };
    const ctx = {
      railsOptions: { enabled: true },
      _mergeGemTree() { return { merged: true }; },
    };
    assert.deepEqual(addon.postprocessTree.call(ctx, 'js', originalTree), originalTree);
  });

  it('returns original tree when disabled', () => {
    const originalTree = { original: true };
    const ctx = { railsOptions: { enabled: false } };
    assert.deepEqual(addon.postprocessTree.call(ctx, 'all', originalTree), originalTree);
  });
});

// --- postBuild ---

describe('postBuild', () => {
  let origCwd;
  let tmpDir;
  let mocks = [];

  const mockFn = (obj, method, fn) => {
    const m = mock.method(obj, method, fn);
    mocks.push(m);
    return m;
  };

  const mockGemBuild = () => {
    mockFn(childProc, 'spawnSync', () => ({ status: 0 }));
    mockFn(childProc, 'execFile', (_cmd, _args, _opts, cb) => cb(null, 'built'));
    mockFn(console, 'log', () => {});
  };

  afterEach(() => {
    mocks.forEach((m) => m.mock.restore());
    mocks = [];
    if (origCwd) process.chdir(origCwd);
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    origCwd = null;
    tmpDir = null;
  });

  const setupPostBuild = () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecr-postbuild-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);

    const resultDir = path.join(tmpDir, 'build-output');
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
  };

  const runPostBuild = (result) => {
    return addon.postBuild.call({ railsOptions: { enabled: true } }, result);
  };

  it('skips everything when not enabled', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecr-postbuild-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);

    addon.postBuild.call({ railsOptions: { enabled: false } }, { directory: '/nonexistent' });
    assert.ok(!fs.existsSync(path.join(tmpDir, 'dist-rails')), 'dist-rails not created');
  });

  it('creates dist-rails directory', async () => {
    mockGemBuild();
    await runPostBuild(setupPostBuild());

    assert.ok(fs.existsSync(path.join(tmpDir, 'dist-rails')), 'dist-rails created');
  });

  it('copies build output to dist-rails/public', async () => {
    mockGemBuild();
    await runPostBuild(setupPostBuild());

    assert.ok(fs.existsSync(path.join(tmpDir, 'dist-rails/public/assets/app.js')), 'assets copied');
  });

  it('removes index.html and robots.txt from public', async () => {
    mockGemBuild();
    await runPostBuild(setupPostBuild());

    assert.ok(!fs.existsSync(path.join(tmpDir, 'dist-rails/public/index.html')), 'index.html removed');
    assert.ok(!fs.existsSync(path.join(tmpDir, 'dist-rails/public/robots.txt')), 'robots.txt removed');
  });

  it('handles missing index.html and robots.txt gracefully', async () => {
    const result = setupPostBuild();
    fs.unlinkSync(path.join(result.directory, 'index.html'));
    fs.unlinkSync(path.join(result.directory, 'robots.txt'));
    mockGemBuild();

    await runPostBuild(result);
  });

  it('moves app/, lib/, ember-app.gemspec out of public', async () => {
    mockGemBuild();
    await runPostBuild(setupPostBuild());

    const distRails = path.join(tmpDir, 'dist-rails');
    assert.ok(fs.existsSync(path.join(distRails, 'app', 'boot.erb')), 'app/ moved to root');
    assert.ok(fs.existsSync(path.join(distRails, 'lib', 'my-app.rb')), 'lib/ moved to root');
    assert.ok(fs.existsSync(path.join(distRails, 'ember-app.gemspec')), 'gemspec moved to root');
    assert.ok(!fs.existsSync(path.join(distRails, 'public', 'app')), 'app/ removed from public');
    assert.ok(!fs.existsSync(path.join(distRails, 'public', 'lib')), 'lib/ removed from public');
    assert.ok(!fs.existsSync(path.join(distRails, 'public', 'ember-app.gemspec')), 'gemspec removed from public');
  });

  it('throws when gem command is not found', () => {
    mockFn(childProc, 'spawnSync', () => ({ status: 1 }));
    mockFn(console, 'log', () => {});

    assert.throws(() => runPostBuild(setupPostBuild()), { message: 'RubyGems is not installed' });
  });

  it('calls gem build with correct command and cwd', async () => {
    mockFn(childProc, 'spawnSync', () => ({ status: 0 }));
    const execMock = mockFn(childProc, 'execFile', (_cmd, _args, _opts, cb) => cb(null, 'Successfully built'));
    mockFn(console, 'log', () => {});

    await runPostBuild(setupPostBuild());

    assert.equal(execMock.mock.calls.length, 1);
    assert.equal(execMock.mock.calls[0].arguments[0], 'gem');
    assert.deepEqual(execMock.mock.calls[0].arguments[1], ['build', 'ember-app.gemspec']);
    const execOpts = execMock.mock.calls[0].arguments[2];
    assert.equal(execOpts.cwd, path.resolve('./dist-rails'));
    assert.equal(execOpts.timeout, 20000);
    assert.equal(execOpts.encoding, 'utf-8');
  });
});

// --- embroiderBuild ---

describe('embroiderBuild', () => {
  const Module = require('module');
  const origResolve = Module._resolveFilename;
  const fakeWebpackPath = path.join(os.tmpdir(), 'fake-embroider-webpack.js');
  const fakeCompatPath = path.join(os.tmpdir(), 'fake-embroider-compat.js');

  const withEmbroiderMocks = (compatBuild, fn) => {
    Module._resolveFilename = function (request, parent) {
      if (request === '@embroider/webpack') return fakeWebpackPath;
      if (request === '@embroider/compat') return fakeCompatPath;
      return origResolve.call(this, request, parent);
    };
    require.cache[fakeWebpackPath] = {
      id: fakeWebpackPath, filename: fakeWebpackPath, loaded: true,
      exports: { Webpack: class FakeWebpack {} },
    };
    require.cache[fakeCompatPath] = {
      id: fakeCompatPath, filename: fakeCompatPath, loaded: true,
      exports: { compatBuild },
    };
    try {
      return fn();
    } finally {
      Module._resolveFilename = origResolve;
      delete require.cache[fakeWebpackPath];
      delete require.cache[fakeCompatPath];
    }
  };

  const makeMockSelf = (overrides) => Object.assign({
    name: 'ember-cli-rails',
    railsOptions: { enabled: false, pkg: { name: 'my-app' }, _appRootURL: '' },
  }, overrides);

  it('throws when addon is not found in project addons', () => {
    assert.throws(() => {
      addon.embroiderBuild({ project: { addons: [] } }, {});
    }, { message: 'Could not find ember-cli-rails dependency.' });
  });

  it('computes publicAssetURL when enabled', () => {
    const mockSelf = makeMockSelf({
      railsOptions: { enabled: true, pkg: { name: 'my-app' }, id: 'ember-{{ name }}' },
      _mergeGemTree(tree) { return { merged: true, tree }; },
    });

    withEmbroiderMocks(() => ({ fakeTree: true }), () => {
      const result = addon.embroiderBuild(
        { project: { addons: [mockSelf] } },
        { packagerOptions: { publicAssetURL: 'https://cdn.com/' } },
      );
      assert.equal(result.merged, true);
    });
  });

  it('returns tree without merging when disabled', () => {
    const mockSelf = makeMockSelf({
      _mergeGemTree() { throw new Error('should not be called'); },
    });

    withEmbroiderMocks(() => ({ fakeTree: true }), () => {
      const result = addon.embroiderBuild({ project: { addons: [mockSelf] } }, {});
      assert.deepEqual(result, { fakeTree: true });
    });
  });

  it('calls postprocessAppTree callback when provided', () => {
    const mockSelf = makeMockSelf();

    withEmbroiderMocks(() => ({ original: true }), () => {
      const result = addon.embroiderBuild({ project: { addons: [mockSelf] } }, {
        postprocessAppTree(tree) {
          return { processed: true, from: tree };
        },
      });
      assert.equal(result.processed, true);
      assert.deepEqual(result.from, { original: true });
    });
  });
});

// --- postBuild symlink handling ---

describe('postBuild symlink handling', () => {
  let origCwd;
  let tmpDir;
  let mocks = [];

  const mockFn = (obj, method, fn) => {
    const m = mock.method(obj, method, fn);
    mocks.push(m);
    return m;
  };

  const mockGemBuild = () => {
    mockFn(childProc, 'spawnSync', () => ({ status: 0 }));
    mockFn(childProc, 'execFile', (_cmd, _args, _opts, cb) => cb(null, 'built'));
    mockFn(console, 'log', () => {});
  };

  afterEach(() => {
    mocks.forEach((m) => m.mock.restore());
    mocks = [];
    if (origCwd) process.chdir(origCwd);
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
    origCwd = null;
    tmpDir = null;
  });

  const setupWithSymlinks = () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecr-symlink-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);

    // Create an external directory (simulating broccoli temp output)
    const externalDir = path.join(tmpDir, 'broccoli-tmp');
    fs.mkdirSync(externalDir);
    fs.writeFileSync(path.join(externalDir, 'chunk.abc123.css'), 'body{}');
    fs.mkdirSync(path.join(externalDir, 'images'));
    fs.writeFileSync(path.join(externalDir, 'images', 'logo.png'), 'PNG');

    // Create build output with symlinks
    const resultDir = path.join(tmpDir, 'build-output');
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

    // Add symlinked file (like broccoli does)
    fs.symlinkSync(
      path.join(externalDir, 'chunk.abc123.css'),
      path.join(resultDir, 'chunk.abc123.css'),
    );

    // Add symlinked directory
    fs.symlinkSync(externalDir, path.join(resultDir, 'linked-assets'));

    // Add relative symlink inside assets
    fs.symlinkSync('../assets/app.js', path.join(resultDir, 'assets', 'app-link.js'));

    return { directory: resultDir };
  };

  const runPostBuild = (result) => {
    return addon.postBuild.call({ railsOptions: { enabled: true } }, result);
  };

  const walkTree = (dir) => {
    const entries = [];
    const walk = (d) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        entries.push(full);
        // Use statSync to follow symlinks for directory check
        if (fs.statSync(full).isDirectory()) walk(full);
      }
    };
    walk(dir);
    return entries;
  };

  it('dereferences symlinked files in build output', async () => {
    mockGemBuild();
    await runPostBuild(setupWithSymlinks());

    const cssPath = path.join(tmpDir, 'dist-rails/public/chunk.abc123.css');
    assert.ok(fs.existsSync(cssPath), 'symlinked file was copied');
    assert.ok(!fs.lstatSync(cssPath).isSymbolicLink(), 'file is not a symlink');
    assert.equal(fs.readFileSync(cssPath, 'utf-8'), 'body{}', 'content is correct');
  });

  it('dereferences symlinked directories in build output', async () => {
    mockGemBuild();
    await runPostBuild(setupWithSymlinks());

    const dirPath = path.join(tmpDir, 'dist-rails/public/linked-assets');
    assert.ok(fs.existsSync(dirPath), 'symlinked directory was copied');
    assert.ok(!fs.lstatSync(dirPath).isSymbolicLink(), 'directory is not a symlink');
    assert.ok(fs.statSync(dirPath).isDirectory(), 'is a real directory');

    const filePath = path.join(dirPath, 'chunk.abc123.css');
    assert.ok(fs.existsSync(filePath), 'file inside symlinked dir was copied');
    assert.ok(!fs.lstatSync(filePath).isSymbolicLink(), 'file inside is not a symlink');
  });

  it('dereferences relative symlinks in build output', async () => {
    mockGemBuild();
    await runPostBuild(setupWithSymlinks());

    const linkPath = path.join(tmpDir, 'dist-rails/public/assets/app-link.js');
    assert.ok(fs.existsSync(linkPath), 'relative symlink target was copied');
    assert.ok(!fs.lstatSync(linkPath).isSymbolicLink(), 'is not a symlink');
    assert.equal(fs.readFileSync(linkPath, 'utf-8'), 'console.log("app")', 'content matches target');
  });

  it('dist-rails tree contains no symlinks', async () => {
    mockGemBuild();
    await runPostBuild(setupWithSymlinks());

    const distRails = path.join(tmpDir, 'dist-rails');
    const allEntries = walkTree(distRails);
    const symlinks = allEntries.filter((e) => fs.lstatSync(e).isSymbolicLink());
    assert.equal(symlinks.length, 0, `found symlinks: ${symlinks.map((s) => path.relative(distRails, s)).join(', ')}`);
  });
});
