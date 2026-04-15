const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const childProc = require('child_process');

const addon = require('../lib/ember-addon');
const pkg = require('../package.json');

// --- v2 addon contract ---

describe('v2 addon package.json', () => {
  const requireExport = (key) => {
    const entry = pkg.exports[key];
    assert.ok(entry, `exports["${key}"] is defined`);
    return require(path.resolve(__dirname, '..', entry.default || entry));
  };

  it('declares v2 addon format with required fields', () => {
    assert.equal(pkg['ember-addon'].version, 2);
    assert.equal(pkg['ember-addon'].type, 'addon');
    assert.ok(pkg.keywords.includes('ember-addon'));
    assert.ok(!Object.keys(pkg.dependencies || {}).includes('ember-cli-babel'));
  });

  it('ember-addon.main resolves to the addon module with hooks', () => {
    const resolved = require(path.resolve(__dirname, '..', pkg['ember-addon'].main));
    assert.equal(resolved.name, 'ember-cli-rails');
    for (const hook of ['included', 'contentFor', 'postBuild']) {
      assert.equal(typeof resolved[hook], 'function', `${hook} is a function`);
    }
  });

  it('package exports resolve to correct modules', () => {
    assert.equal(requireExport('.').name, 'ember-cli-rails');
    assert.equal(typeof requireExport('./vite-plugin'), 'function');
  });
});

// --- contentFor ---

describe('contentFor', () => {
  it('returns empty string for app-boot and config-module', () => {
    assert.equal(addon.contentFor('app-boot'), '');
    assert.equal(addon.contentFor('config-module'), '');
  });

  for (const type of ['body', 'head', 'head-footer', 'custom-section']) {
    it(`returns placeholder for ${type}`, () => {
      assert.equal(addon.contentFor(type), `<!-- content-for:${type} -->`);
    });
  }
});

// --- _initializeOptions ---

describe('_initializeOptions', () => {
  let mocks = [];

  afterEach(() => {
    mocks.forEach((m) => m.mock.restore());
    mocks = [];
  });

  const makeContext = (env = 'development') => ({ app: { env } });

  const makeAppOptions = (overrides = {}) => ({
    project: {
      pkg: { name: 'my-app' },
      config() { return {}; },
    },
    ...overrides,
  });

  const makeAppOptionsWithRootURL = (rootURL, overrides = {}) => ({
    ...makeAppOptions(overrides),
    project: { pkg: { name: 'my-app' }, config() { return { rootURL }; } },
  });

  // Run _initializeOptions and return { ctx, appOpts } for assertions
  const initOpts = (appOpts, env) => {
    const ctx = makeContext(env);
    addon._initializeOptions.call(ctx, appOpts);
    return { ctx, appOpts };
  };

  it('applies default options and stores them on context', () => {
    const { ctx } = initOpts(makeAppOptions({ fingerprint: { enabled: true } }));

    assert.ok(ctx.railsOptions);
    assert.equal(ctx.railsOptions.enabled, true);
    assert.equal(ctx.railsOptions.id, 'ember-{{ name }}');
    assert.equal(ctx.railsOptions.pkg.name, 'my-app');
  });

  it('preserves user-provided emberRails options', () => {
    const { ctx } = initOpts(makeAppOptions({
      emberRails: { id: 'custom-{{ name }}', enabled: true },
      fingerprint: { enabled: true },
    }));
    assert.equal(ctx.railsOptions.id, 'custom-{{ name }}');
  });

  it('does not override existing emberRails properties with defaults', () => {
    const { ctx } = initOpts(makeAppOptions({ emberRails: { enabled: false } }));
    assert.equal(ctx.railsOptions.enabled, false);
  });

  it('disables when fingerprint.enabled is false and not production', () => {
    const warnMock = mock.method(console, 'warn', () => {});
    mocks.push(warnMock);
    const { ctx } = initOpts(makeAppOptions({ fingerprint: { enabled: false } }));

    assert.equal(ctx.railsOptions.enabled, false);
    const warned = warnMock.mock.calls.some(
      (c) => c.arguments[0].includes('Skipping ember-cli-rails'),
    );
    assert.ok(warned);
  });

  it('stays enabled in production even with fingerprint disabled', () => {
    const { ctx } = initOpts(makeAppOptions({ fingerprint: { enabled: false } }), 'production');
    assert.equal(ctx.railsOptions.enabled, true);
  });

  it('computes fingerprint.prepend with meta.path, stripping trailing slash', () => {
    for (const prepend of ['https://cdn.example.com/', 'https://cdn.example.com']) {
      const { appOpts } = initOpts(makeAppOptions({
        fingerprint: { enabled: true, prepend },
      }));
      assert.equal(appOpts.fingerprint.prepend, 'https://cdn.example.com/ember_my_app/');
    }
  });

  it('computes autoImport.publicAssetURL', () => {
    const { appOpts } = initOpts(
      makeAppOptionsWithRootURL('/admin', { fingerprint: { enabled: true } }),
    );
    assert.equal(appOpts.autoImport.publicAssetURL, '/ember_my_app/admin/assets');
  });

  it('creates autoImport if absent', () => {
    const appOpts = makeAppOptions({ fingerprint: { enabled: true } });
    assert.equal(appOpts.autoImport, undefined);
    const result = initOpts(appOpts);
    assert.ok(result.appOpts.autoImport);
    assert.ok(result.appOpts.autoImport.publicAssetURL);
  });

  it('uses options.prepend as fallback for fingerprint and autoImport', () => {
    const { appOpts } = initOpts(makeAppOptions({
      emberRails: { prepend: 'https://alt.com/' },
      fingerprint: { enabled: true },
    }));
    assert.ok(appOpts.fingerprint.prepend.startsWith('https://alt.com/'));
    assert.ok(appOpts.autoImport.publicAssetURL.startsWith('https://alt.com/'));
  });

  // --- rootURL resolution (ember-cli 6.12+ hook ordering fix) ---

  it('resolves _appRootURL from project.config() rootURL', () => {
    const { ctx } = initOpts(
      makeAppOptionsWithRootURL('/admin/', { fingerprint: { enabled: true } }),
    );
    assert.equal(ctx.railsOptions._appRootURL, '/admin');
  });

  it('sets _appRootURL to empty when rootURL is / or absent', () => {
    const { ctx: ctx1 } = initOpts(
      makeAppOptionsWithRootURL('/', { fingerprint: { enabled: true } }),
    );
    assert.equal(ctx1.railsOptions._appRootURL, '');

    const { ctx: ctx2 } = initOpts(makeAppOptions({ fingerprint: { enabled: true } }));
    assert.equal(ctx2.railsOptions._appRootURL, '');
  });

  it('preserves user override of _appRootURL', () => {
    const { ctx } = initOpts(makeAppOptionsWithRootURL('/', {
      emberRails: { _appRootURL: '/custom' },
      fingerprint: { enabled: true },
    }));
    assert.equal(ctx.railsOptions._appRootURL, '/custom');
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
    mockFn(childProc, 'spawnSync', () => ({ status: 0, stdout: 'built' }));
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

  const railsOpts = { enabled: true, pkg: { name: 'my-app' }, id: 'ember-{{ name }}' };

  const setupBuildDir = () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecr-postbuild-'));
    origCwd = process.cwd();
    process.chdir(tmpDir);

    const resultDir = path.join(tmpDir, 'build-output');
    fs.mkdirSync(path.join(resultDir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(resultDir, 'assets', 'app.js'), 'console.log("app")');
    fs.writeFileSync(path.join(resultDir, 'index.html'), '<!-- content-for:body -->');
    fs.writeFileSync(path.join(resultDir, 'robots.txt'), 'User-agent: *');
    return { directory: resultDir };
  };

  const runPostBuild = (result) => {
    return addon.postBuild.call({ railsOptions: railsOpts }, result);
  };

  it('skips everything when not enabled', () => {
    setupBuildDir();
    addon.postBuild.call({ railsOptions: { enabled: false } }, { directory: '/nonexistent' });
    assert.ok(!fs.existsSync(path.join(tmpDir, 'dist-rails')));
  });

  it('produces correct dist-rails structure', () => {
    mockGemBuild();
    runPostBuild(setupBuildDir());

    const distRails = path.join(tmpDir, 'dist-rails');

    // Directory created with assets
    assert.ok(fs.existsSync(distRails));
    assert.ok(fs.existsSync(path.join(distRails, 'public/assets/app.js')));

    // Non-asset files removed from public
    assert.ok(!fs.existsSync(path.join(distRails, 'public/index.html')));
    assert.ok(!fs.existsSync(path.join(distRails, 'public/robots.txt')));

    // Gem scaffold in root, not public
    assert.ok(fs.existsSync(path.join(distRails, 'ember-app.gemspec')));
    assert.ok(fs.existsSync(path.join(distRails, 'lib/ember-my-app.rb')));
    assert.ok(fs.existsSync(path.join(distRails, 'lib/ember-my-app.rake')));
    assert.ok(fs.existsSync(path.join(distRails, 'app/views')));
    assert.ok(!fs.existsSync(path.join(distRails, 'public/ember-app.gemspec')));
    assert.ok(!fs.existsSync(path.join(distRails, 'public/lib')));
  });

  it('handles missing index.html and robots.txt gracefully', () => {
    const result = setupBuildDir();
    fs.unlinkSync(path.join(result.directory, 'index.html'));
    fs.unlinkSync(path.join(result.directory, 'robots.txt'));
    mockGemBuild();
    runPostBuild(result);
  });

  it('throws when gem command is not found', () => {
    mockFn(childProc, 'spawnSync', () => ({ status: 1 }));
    mockFn(console, 'log', () => {});
    assert.throws(() => runPostBuild(setupBuildDir()), { message: 'RubyGems is not installed' });
  });

  it('calls gem build with correct command and cwd', () => {
    const spawnMock = mockFn(childProc, 'spawnSync', () => ({ status: 0, stdout: 'built' }));
    mockFn(console, 'log', () => {});
    runPostBuild(setupBuildDir());

    const gemBuildCall = spawnMock.mock.calls.find(
      (c) => c.arguments[0] === 'gem' && c.arguments[1]?.[0] === 'build',
    );
    assert.ok(gemBuildCall, 'gem build was called');
    assert.deepEqual(gemBuildCall.arguments[1], ['build', 'ember-app.gemspec']);
    assert.equal(gemBuildCall.arguments[2].cwd, path.resolve('dist-rails'));
    assert.equal(gemBuildCall.arguments[2].timeout, 20000);
    assert.equal(gemBuildCall.arguments[2].encoding, 'utf-8');
  });

  it('dereferences all symlinks in build output', () => {
    const result = setupBuildDir();

    // External directory simulating broccoli temp output
    const externalDir = path.join(tmpDir, 'broccoli-tmp');
    fs.mkdirSync(path.join(externalDir, 'images'), { recursive: true });
    fs.writeFileSync(path.join(externalDir, 'chunk.abc123.css'), 'body{}');
    fs.writeFileSync(path.join(externalDir, 'images', 'logo.png'), 'PNG');

    // Symlinked file, directory, and relative symlink
    fs.symlinkSync(
      path.join(externalDir, 'chunk.abc123.css'),
      path.join(result.directory, 'chunk.abc123.css'),
    );
    fs.symlinkSync(externalDir, path.join(result.directory, 'linked-assets'));
    fs.symlinkSync('../assets/app.js', path.join(result.directory, 'assets', 'app-link.js'));

    mockGemBuild();
    runPostBuild(result);

    const pub = path.join(tmpDir, 'dist-rails/public');

    // Symlinked file dereferenced with correct content
    assert.ok(!fs.lstatSync(path.join(pub, 'chunk.abc123.css')).isSymbolicLink());
    assert.equal(fs.readFileSync(path.join(pub, 'chunk.abc123.css'), 'utf-8'), 'body{}');

    // Symlinked directory dereferenced
    assert.ok(fs.statSync(path.join(pub, 'linked-assets')).isDirectory());
    assert.ok(!fs.lstatSync(path.join(pub, 'linked-assets')).isSymbolicLink());

    // Relative symlink dereferenced with correct content
    assert.ok(!fs.lstatSync(path.join(pub, 'assets/app-link.js')).isSymbolicLink());
    assert.equal(fs.readFileSync(path.join(pub, 'assets/app-link.js'), 'utf-8'), 'console.log("app")');

    // No symlinks anywhere in the tree
    const allFiles = [];
    const walk = (d) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        const full = path.join(d, entry.name);
        allFiles.push(full);
        if (fs.statSync(full).isDirectory()) walk(full);
      }
    };
    walk(path.join(tmpDir, 'dist-rails'));
    const symlinks = allFiles.filter((e) => fs.lstatSync(e).isSymbolicLink());
    assert.equal(symlinks.length, 0, `unexpected symlinks: ${symlinks.join(', ')}`);
  });
});

// --- embroiderBuild ---

describe('embroider builds', () => {
  const fakeProjectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ecr-embroider-'));
  const fakeModDir = path.join(fakeProjectRoot, 'node_modules');
  const fakeWebpackDir = path.join(fakeModDir, '@embroider', 'webpack');
  const fakeCompatDir = path.join(fakeModDir, '@embroider', 'compat');

  const withEmbroiderMocks = (compatBuild, fn) => {
    fs.mkdirSync(fakeWebpackDir, { recursive: true });
    fs.mkdirSync(fakeCompatDir, { recursive: true });
    fs.writeFileSync(path.join(fakeWebpackDir, 'index.js'), '');
    fs.writeFileSync(path.join(fakeCompatDir, 'index.js'), '');

    const wpPath = require.resolve('@embroider/webpack', { paths: [fakeProjectRoot] });
    const compatPath = require.resolve('@embroider/compat', { paths: [fakeProjectRoot] });

    require.cache[wpPath] = {
      id: wpPath, filename: wpPath, loaded: true,
      exports: { Webpack: class FakeWebpack {} },
    };
    require.cache[compatPath] = {
      id: compatPath, filename: compatPath, loaded: true,
      exports: { compatBuild },
    };
    try {
      return fn();
    } finally {
      delete require.cache[wpPath];
      delete require.cache[compatPath];
      fs.rmSync(fakeModDir, { recursive: true, force: true });
    }
  };

  const makeMockSelf = (overrides = {}) => ({
    name: 'ember-cli-rails',
    railsOptions: { enabled: false, pkg: { name: 'my-app' }, _appRootURL: '' },
    ...overrides,
  });

  const makeApp = (addons = []) => ({
    project: { root: fakeProjectRoot, addons },
  });

  it('throws when addon is not found in project addons', () => {
    withEmbroiderMocks(() => ({}), () => {
      assert.throws(() => addon.embroiderBuild(makeApp(), {}), {
        message: 'Could not find ember-cli-rails dependency.',
      });
    });
  });

  it('computes publicAssetURL when enabled', () => {
    const mockSelf = makeMockSelf({
      railsOptions: {
        enabled: true, pkg: { name: 'my-app' }, id: 'ember-{{ name }}', _appRootURL: '',
      },
    });

    let capturedOpts;
    withEmbroiderMocks(
      (_app, _builder, opts) => { capturedOpts = opts; return {}; },
      () => {
        addon.embroiderBuild(makeApp([mockSelf]), {
          packagerOptions: { publicAssetURL: 'https://cdn.com/' },
        });
        assert.ok(capturedOpts.packagerOptions.publicAssetURL.includes('ember_my_app'));
      },
    );
  });

  it('returns tree directly when disabled', () => {
    withEmbroiderMocks(() => ({ fakeTree: true }), () => {
      const result = addon.embroiderBuild(makeApp([makeMockSelf()]), {});
      assert.deepEqual(result, { fakeTree: true });
    });
  });

  it('calls postprocessAppTree callback when provided', () => {
    withEmbroiderMocks(() => ({ original: true }), () => {
      const result = addon.embroiderBuild(makeApp([makeMockSelf()]), {
        postprocessAppTree(tree) { return { processed: true, from: tree }; },
      });
      assert.equal(result.processed, true);
      assert.deepEqual(result.from, { original: true });
    });
  });

  it('passes Webpack as the build function', () => {
    let receivedBuilder;
    withEmbroiderMocks(
      (_app, builder) => { receivedBuilder = builder; return {}; },
      () => {
        addon.embroiderBuild(makeApp([makeMockSelf()]), {});
        assert.equal(receivedBuilder.name, 'FakeWebpack');
      },
    );
  });
});
