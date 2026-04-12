# Changelog

All notable changes to this project are documented in this file.

## 2.0.0

### Breaking Changes from 1.x

- **Removed** asset manifest helpers and cumulative JS/CSS Rails view helpers from the Rails engine
- **Removed** `broccoli-funnel` dependency (no longer used)
- **Simplified** the Rails engine to focus on direct asset serving and layout rendering
- **Converted** `AssetPackager` to an ES class — calling without `new` now throws (was previously supported via factory pattern)
- **Requires** Node.js >= 18

### New Features

- Added Embroider support via `embroiderBuild()` for wrapping Embroider-based builds
- Added `postprocessAppTree` callback support in `embroiderBuild`
- Added `render_<app>` controller helper for direct Ember app rendering from Rails controllers, with argument forwarding
- Added `normalize-path` to declared dependencies (previously required but missing)

### Improvements

- Modernized all JavaScript to ES2015+ (`const`/`let`, ES classes, arrow functions, template literals)
- Added comprehensive test suite (90 tests) using Node's built-in test runner
- Added GitHub Actions CI workflow
- Added ESLint `no-var` and `prefer-const` rules
- Verified `gem` command exists before running `gem build`, with clear error messaging
- Added `files` field to package.json to control published contents
- Added `engines` field declaring Node >= 18 requirement

---

## Pre-release History

## 2.0.0-rc.3

- Verified `gem` command exists before running `gem build`, with a clear error message when RubyGems is not installed
- Added platform-aware check (`which` on Unix, `where` on Windows)
- Added a comprehensive test suite (90 tests) using Node's built-in test runner
- Added GitHub Actions CI workflow with lint, test, and Ember integration jobs
- Added `normalize-path` to declared dependencies (was previously required but missing)

## 2.0.0-rc.1

- Added `postprocessAppTree` callback support in `embroiderBuild`, allowing apps to modify the tree after Embroider's build step

## 2.0.0-beta.3

- The `render_<app>` controller helper now accepts arguments, forwarding them to Rails `render`

## 2.0.0-beta.2

- Added Embroider support via `embroiderBuild()` function that apps import to wrap their build
- Embroider builds correctly compute `publicAssetURL` with the package path prefix
- Content placeholders for `app-boot` and `config-module` return empty strings (Embroider-only, not from index.html)

## 2.0.0-beta.1

- Removed asset manifest helpers and cumulative JS/CSS helpers from the Rails engine
- Removed `broccoli-asset-rev` and `broccoli-funnel` from direct build-time usage for manifests
- Simplified the Rails engine to focus on direct asset serving and layout rendering

## 1.2.0-rc.3

- Fixed `rootURL` handling so it correctly prefixes asset paths and chunk URLs
- Fixed `autoImport.publicAssetURL` computation to include `rootURL`

## 1.2.0-rc.2

- Added `render_<app>` helper method to Rails controllers for direct Ember app rendering
- The helper renders with the Ember app's boot layout automatically
- Added ERB layout generation from `index.html` with `content-for` placeholder conversion

## 1.1.0-rc.1

- Added cumulative JavaScript and CSS Rails view helpers for including all app assets
- Added `contentFor` hook to inject placeholders into `index.html` for ERB conversion

## 1.0.0-rc.4

- Added support for Webpack chunk assets via `autoImport.publicAssetURL` configuration
- Asset URLs for chunked builds are prefixed with the package path

## 1.0.0-rc.2

- Upgraded `ember-cli-babel` to v7 and `fs-extra` to v10
- Updated `broccoli-funnel` and `broccoli-merge-trees` to latest versions

## 1.0.0-rc.1

- Added configurable asset path via `rootURL` option in `getPackageMeta`
- When `rootURL` is set, it is used as the asset path instead of the derived package ID
- Added ESLint with `eslint:recommended` configuration and `lint` script

## 1.0.0-beta.13

- Fixed Rails engine initializer name to use the package class name for clarity

## 1.0.0-beta.12

- Upgraded static file middleware for Rails 6.1 compatibility
- Replaced custom middleware approach with `ActionDispatch::Static` delegation

## 1.0.0-beta.11

- Moved gem build output into `dist-rails/` subdirectory instead of `dist/`
- Build copies output to `dist-rails/public/`, then moves `app/`, `lib/`, and gemspec to root
- Removes `index.html` and `robots.txt` from the gem's public directory
- Updated Rails engine to serve assets from a `public/` subdirectory

## 1.0.0-beta.3

- Switched template engine from Mustache to Handlebars
- Switched from `mkdirp` to `fs-extra` for directory creation

## 1.0.0-beta.2

- Added support for `prepend` configuration option for CDN URL prefixing
- Refactored `getPackageMeta` to use computed `id` from Handlebars template
- Default gem ID template is `ember-{{ name }}`

## 1.0.0-beta.1

- Fixed `gem build` error when addon is disabled
- Added graceful skip when `broccoli-asset-rev` is not enabled in non-production builds
- Added `broccoli-asset-rev` as a dev dependency

## 1.0.0-beta.0

- Renamed npm package from `ember-rails` to `ember-cli-rails`
- Added `assetMap.json` to gemspec files
- Major cleanup of defunct code paths

## 1.2.0

- Upgraded to `broccoli-plugin` from `broccoli-writer`
- Added `assets:precompile` Rake task enhancement to copy gem assets to `public/`
- Removed direct asset pipeline integration in favor of static file serving
- Added Rack middleware to serve Ember assets under the app path prefix

## 1.1.0

- Deprecated `idPrefix` option in favor of configurable `id` template
- Introduced `getPackageMeta` helper for computing package metadata (id, path, class)

## 1.0.2

- Added Rails 5 support by updating `railties` dependency to `>= 4.0`

## 1.0.1

- Added README with usage instructions and demo link
- Added Version Badge demo URL to package metadata

## 1.0.0

- Initial release
- Ember CLI addon that wraps build output into a RubyGem for Rails asset pipeline
- Generates gemspec, Rails engine, and Rake tasks from Handlebars templates
- Converts `index.html` content-for placeholders to ERB yield blocks
- Runs `gem build` automatically after `ember build`
