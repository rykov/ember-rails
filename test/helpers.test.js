const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const helpers = require('../lib/helpers');

describe('getPackageMeta', () => {

  // --- base field (name sanitization) ---

  describe('base', () => {
    it('passes through simple alphanumeric-hyphen name', () => {
      const result = helpers.getPackageMeta('my-app', {});
      assert.equal(result.base, 'my-app');
    });

    it('strips @ and / from scoped name', () => {
      const result = helpers.getPackageMeta('@scope/my-app', {});
      assert.equal(result.base, 'scopemy-app');
    });

    it('strips dots', () => {
      const result = helpers.getPackageMeta('my.app', {});
      assert.equal(result.base, 'myapp');
    });

    it('keeps underscores', () => {
      const result = helpers.getPackageMeta('my_app', {});
      assert.equal(result.base, 'my_app');
    });

    it('strips spaces and special characters', () => {
      const result = helpers.getPackageMeta('my app!@#', {});
      assert.equal(result.base, 'myapp');
    });

    it('returns empty string for empty input', () => {
      const result = helpers.getPackageMeta('', {});
      assert.equal(result.base, '');
    });
  });

  // --- id field (Handlebars template) ---

  describe('id', () => {
    it('uses base name with default template', () => {
      const result = helpers.getPackageMeta('my-app', {});
      assert.equal(result.id, 'my-app');
    });

    it('applies custom template with prefix', () => {
      const result = helpers.getPackageMeta('chat', { id: 'ember-{{ name }}' });
      assert.equal(result.id, 'ember-chat');
    });

    it('uses static id without template variable', () => {
      const result = helpers.getPackageMeta('anything', { id: 'fixed-id' });
      assert.equal(result.id, 'fixed-id');
    });

    it('applies explicit {{ name }} template', () => {
      const result = helpers.getPackageMeta('my-app', { id: '{{ name }}' });
      assert.equal(result.id, 'my-app');
    });
  });

  // --- path field ---

  describe('path', () => {
    it('replaces hyphens with underscores when no rootURL', () => {
      const result = helpers.getPackageMeta('my-app', {});
      assert.equal(result.path, 'my_app');
    });

    it('leaves name without hyphens unchanged', () => {
      const result = helpers.getPackageMeta('myapp', {});
      assert.equal(result.path, 'myapp');
    });

    it('strips leading and trailing slashes from rootURL', () => {
      const result = helpers.getPackageMeta('x', { rootURL: '/some/path/' });
      assert.equal(result.path, 'some/path');
    });

    it('returns empty string for rootURL of /', () => {
      const result = helpers.getPackageMeta('x', { rootURL: '/' });
      assert.equal(result.path, '');
    });

    it('preserves middle slashes in rootURL', () => {
      const result = helpers.getPackageMeta('x', { rootURL: '/a/b/c/' });
      assert.equal(result.path, 'a/b/c');
    });

    it('passes through rootURL without slashes', () => {
      const result = helpers.getPackageMeta('x', { rootURL: 'assets' });
      assert.equal(result.path, 'assets');
    });

    it('uses id template for path computation', () => {
      const result = helpers.getPackageMeta('app', { id: 'ember-{{ name }}' });
      assert.equal(result.path, 'ember_app');
    });
  });

  // --- class field (PascalCase) ---

  describe('class', () => {
    it('converts hyphenated name to PascalCase', () => {
      const result = helpers.getPackageMeta('my-app', {});
      assert.equal(result.class, 'MyApp');
    });

    it('converts underscored name to PascalCase', () => {
      const result = helpers.getPackageMeta('my_app', {});
      assert.equal(result.class, 'MyApp');
    });

    it('handles numbers in name', () => {
      const result = helpers.getPackageMeta('app-2-go', {});
      assert.equal(result.class, 'App2Go');
    });

    it('capitalizes single word', () => {
      const result = helpers.getPackageMeta('dashboard', {});
      assert.equal(result.class, 'Dashboard');
    });

    it('returns empty string for empty input', () => {
      const result = helpers.getPackageMeta('', {});
      assert.equal(result.class, '');
    });

    it('handles multiple consecutive separators', () => {
      const result = helpers.getPackageMeta('my---app', {});
      assert.equal(result.class, 'MyApp');
    });
  });

  // --- full integration ---

  describe('integration', () => {
    it('computes all fields for typical usage', () => {
      const result = helpers.getPackageMeta('my-ember-app', { id: 'ember-{{ name }}' });
      assert.deepEqual(result, {
        base: 'my-ember-app',
        id: 'ember-my-ember-app',
        path: 'ember_my_ember_app',
        class: 'EmberMyEmberApp',
      });
    });

    it('uses rootURL for path instead of id', () => {
      const result = helpers.getPackageMeta('my-app', { rootURL: '/admin/' });
      assert.equal(result.base, 'my-app');
      assert.equal(result.id, 'my-app');
      assert.equal(result.path, 'admin');
      assert.equal(result.class, 'MyApp');
    });

    it('handles scoped package with custom id template', () => {
      const result = helpers.getPackageMeta('@org/cool-app', { id: 'ember-{{ name }}' });
      assert.deepEqual(result, {
        base: 'orgcool-app',
        id: 'ember-orgcool-app',
        path: 'ember_orgcool_app',
        class: 'EmberOrgcoolApp',
      });
    });
  });
});
