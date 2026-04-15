const { describe, it, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const childProc = require('child_process');

const PLUGIN_PATH = path.resolve(__dirname, '../lib/vite-plugin.js');

const DEFAULT_PKG = {
  name: 'my-app',
  version: '1.0.0',
  author: 'Test Author',
  homepage: 'https://example.com',
  license: 'MIT',
};

describe('vitePlugin', () => {
  let tmpDir;
  let origCwd;
  let mocks = [];
  let origEnv;

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
    if (origEnv !== undefined) {
      process.env.EMBER_CLI_RAILS_VITE = origEnv;
    } else {
      delete process.env.EMBER_CLI_RAILS_VITE;
    }
    origCwd = null;
    tmpDir = null;
    origEnv = undefined;
  });

  // Create a fresh plugin with a temp directory containing package.json, chdir into it
  const initPlugin = (opts = {}) => {
    const pkg = { ...DEFAULT_PKG, ...opts.pkg };
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ecr-vite-'));
    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkg));
    origCwd = process.cwd();
    process.chdir(tmpDir);

    delete require.cache[PLUGIN_PATH];
    return require(PLUGIN_PATH)(opts.pluginOptions);
  };

  // Run config + configResolved hooks with root pointing to tmpDir
  const resolveConfig = (plugin, dir, overrides = {}) => {
    const { mode = 'production', ...configOverrides } = overrides;
    const configInput = { build: { outDir: 'dist' }, command: 'build', root: dir, ...configOverrides };
    const env = { mode, command: configInput.command };
    const result = plugin.config(configInput, env);
    plugin.configResolved({ ...configInput, mode });
    return result;
  };

  // initPlugin + populate dist/ with standard build output
  const setupForCloseBundle = (opts = {}) => {
    const plugin = initPlugin(opts);
    const distDir = path.join(tmpDir, 'dist');
    fs.mkdirSync(path.join(distDir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(distDir, 'assets', 'app.js'), 'console.log("app")');
    fs.writeFileSync(
      path.join(distDir, 'index.html'),
      '<html><!-- content-for:head --><body><!-- content-for:body --></body></html>',
    );
    fs.writeFileSync(path.join(distDir, 'robots.txt'), 'User-agent: *');
    return plugin;
  };

  // Full pipeline: setup, mock gem build, resolve config, run closeBundle
  const setupAndRun = (opts = {}) => {
    const plugin = setupForCloseBundle(opts);
    mockGemBuild();
    resolveConfig(plugin, tmpDir);
    plugin.closeBundle();
  };

  const saveEnv = () => {
    origEnv = process.env.EMBER_CLI_RAILS_VITE;
    delete process.env.EMBER_CLI_RAILS_VITE;
  };

  // --- disabled plugin (explicit or implicit) ---

  const testDisabledPlugin = (label, pluginOptions, mode) => {
    describe(label, () => {
      it('config() does not modify Vite base', () => {
        const plugin = initPlugin({ pluginOptions });
        const result = plugin.config({ root: tmpDir }, { mode });
        assert.equal(result, undefined);
      });

      it('configResolved() does not set EMBER_CLI_RAILS_VITE env var', () => {
        saveEnv();
        const plugin = initPlugin({ pluginOptions });
        resolveConfig(plugin, tmpDir, { mode });
        assert.equal(process.env.EMBER_CLI_RAILS_VITE, undefined);
      });

      it('closeBundle() does not produce dist-rails', () => {
        const plugin = setupForCloseBundle({ pluginOptions });
        resolveConfig(plugin, tmpDir, { mode });
        plugin.closeBundle();
        assert.ok(!fs.existsSync(path.join(tmpDir, 'dist-rails')));
      });
    });
  };

  testDisabledPlugin('enabled: false', { enabled: false }, 'production');
  testDisabledPlugin('non-production mode', undefined, 'development');

  it('can be explicitly enabled in development', () => {
    const plugin = initPlugin({ pluginOptions: { enabled: true } });
    const result = plugin.config({ root: tmpDir }, { mode: 'development' });
    assert.ok(result.base, 'base should be set when explicitly enabled');
  });

  it('returns a plugin with correct name and apply', () => {
    const plugin = initPlugin();
    assert.equal(plugin.name, 'ember-cli-rails');
    assert.equal(plugin.apply, 'build');
  });

  // --- configResolved ---

  it('configResolved sets EMBER_CLI_RAILS_VITE env var', () => {
    saveEnv();
    const plugin = initPlugin();
    resolveConfig(plugin, tmpDir);
    assert.equal(process.env.EMBER_CLI_RAILS_VITE, '1');
  });

  // --- config (base path) ---

  describe('config base path', () => {
    const getBase = (pluginOptions = {}) => {
      const plugin = initPlugin({ pluginOptions });
      return plugin.config({ root: tmpDir }, { mode: 'production' }).base;
    };

    // Strip protocol before checking — https:// contains // legitimately
    const assertNoDoubleSlash = (base) => {
      const pathPart = base.replace(/^https?:\/\//, '');
      assert.ok(!pathPart.includes('//'), `unexpected double slash in: ${base}`);
    };

    it('strips trailing slash from rootURL', () => {
      const base = getBase({ rootURL: '/my-app/' });
      assertNoDoubleSlash(base);
      assert.ok(base.endsWith('/my-app/'), `expected base to end with /my-app/, got: ${base}`);
    });

    it('collapses rootURL "/" to empty', () => {
      assertNoDoubleSlash(getBase({ rootURL: '/' }));
    });

    it('handles rootURL without trailing slash', () => {
      const base = getBase({ rootURL: '/my-app' });
      assertNoDoubleSlash(base);
      assert.ok(base.endsWith('/my-app/'), `expected base to end with /my-app/, got: ${base}`);
    });

    it('handles missing rootURL', () => {
      assertNoDoubleSlash(getBase({}));
    });

    it('strips trailing slashes from both prepend and rootURL', () => {
      const base = getBase({ prepend: 'https://cdn.example.com/', rootURL: '/app/' });
      assertNoDoubleSlash(base);
      assert.match(base, /https:\/\/cdn\.example\.com\/[^/]+\/app\/$/);
    });
  });

  // --- closeBundle ---

  describe('closeBundle', () => {
    it('skips when command is not build', () => {
      const plugin = setupForCloseBundle();
      resolveConfig(plugin, tmpDir, { command: 'serve' });
      plugin.closeBundle();
      assert.ok(!fs.existsSync(path.join(tmpDir, 'dist-rails')));
    });

    it('skips when dist directory does not exist', () => {
      const plugin = initPlugin();
      resolveConfig(plugin, tmpDir);
      plugin.closeBundle();
      assert.ok(!fs.existsSync(path.join(tmpDir, 'dist-rails')));
    });

    it('produces correct dist-rails structure', () => {
      setupAndRun();

      const root = path.join(tmpDir, 'dist-rails');
      const pub = path.join(root, 'public');

      // Gem scaffold in root, not in public
      assert.ok(fs.existsSync(path.join(root, 'ember-app.gemspec')));
      assert.ok(fs.existsSync(path.join(root, 'lib/ember-my-app.rb')));
      assert.ok(fs.existsSync(path.join(root, 'lib/ember-my-app.rake')));
      assert.ok(fs.existsSync(path.join(root, 'app')));
      assert.ok(!fs.existsSync(path.join(pub, 'ember-app.gemspec')));
      assert.ok(!fs.existsSync(path.join(pub, 'lib')));
      assert.ok(!fs.existsSync(path.join(pub, 'app')));

      // Gemspec content
      const gemspec = fs.readFileSync(path.join(root, 'ember-app.gemspec'), 'utf-8');
      assert.ok(gemspec.includes('"ember-my-app"'), 'gemspec contains package ID');
      assert.ok(gemspec.includes('"1.0.0"'), 'gemspec contains version');

      // ERB layout from index.html
      const erbPath = path.join(root, 'app/views/layouts/ember_my_app/boot.erb');
      assert.ok(fs.existsSync(erbPath), 'ERB layout created');
      const erb = fs.readFileSync(erbPath, 'utf-8');
      assert.ok(erb.includes("<%= yield :'head' %>"));
      assert.ok(erb.includes('<%= yield %>'));
      assert.ok(!erb.includes('content-for'));

      // Build assets copied, non-assets removed
      assert.ok(fs.existsSync(path.join(pub, 'assets/app.js')));
      assert.ok(!fs.existsSync(path.join(pub, 'index.html')));
      assert.ok(!fs.existsSync(path.join(pub, 'robots.txt')));
    });

    it('calls gem build with correct arguments', () => {
      const plugin = setupForCloseBundle();
      const spawnMock = mockFn(childProc, 'spawnSync', () => ({ status: 0, stdout: 'built' }));
      mockFn(console, 'log', () => {});
      resolveConfig(plugin, tmpDir);
      plugin.closeBundle();

      const gemBuildCall = spawnMock.mock.calls.find(
        (c) => c.arguments[0] === 'gem' && c.arguments[1]?.[0] === 'build',
      );
      assert.ok(gemBuildCall, 'gem build was called');
      assert.deepEqual(gemBuildCall.arguments[1], ['build', 'ember-app.gemspec']);
      assert.equal(
        gemBuildCall.arguments[2].cwd,
        fs.realpathSync(path.resolve(tmpDir, 'dist-rails')),
      );
    });

    it('throws when RubyGems is not installed', () => {
      const plugin = setupForCloseBundle();
      mockFn(childProc, 'spawnSync', () => ({ status: 1 }));
      mockFn(console, 'log', () => {});
      resolveConfig(plugin, tmpDir);
      assert.throws(() => plugin.closeBundle(), { message: 'RubyGems is not installed' });
    });

    it('uses custom id template', () => {
      setupAndRun({ pluginOptions: { id: 'rails-{{ name }}' } });
      assert.ok(fs.existsSync(path.join(tmpDir, 'dist-rails/lib/rails-my-app.rb')));
    });

    it('uses custom outDir from Vite config', () => {
      const plugin = initPlugin();
      fs.mkdirSync(path.join(tmpDir, 'build-output'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, 'build-output/index.html'),
        '<html><!-- content-for:body --></html>',
      );
      mockGemBuild();
      resolveConfig(plugin, tmpDir, { build: { outDir: 'build-output' } });
      plugin.closeBundle();
      assert.ok(fs.existsSync(path.join(tmpDir, 'dist-rails')));
    });

    it('handles missing index.html gracefully', () => {
      const plugin = initPlugin();
      fs.mkdirSync(path.join(tmpDir, 'dist/assets'), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, 'dist/assets/app.js'), 'console.log("app")');
      mockGemBuild();
      resolveConfig(plugin, tmpDir);
      plugin.closeBundle();
      assert.ok(fs.existsSync(path.join(tmpDir, 'dist-rails')));
      assert.ok(!fs.existsSync(path.join(tmpDir, 'dist-rails/app/views/layouts')));
    });
  });
});
