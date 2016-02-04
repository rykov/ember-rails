# Rails Asset Wrapper for Ember CLI apps

[![npm version](https://badge.fury.io/js/ember-rails.svg)](https://badge.fury.io/js/ember-rails)

This is an Ember addon to build a Rails Asset wrapper for your Ember application which can then
be included as a RubyGem **without other dependencies** in your Rails application.

## Demo

This package was used to deploy the landing page on [Version Badge](https://badge.fury.io/)

## Getting started

If you are using Ember CLI, simply install `ember-rails` as a dev dependency of your
application's `package.json`:

```bash
  npm install ember-rails --save-dev
```

## Usage

Once `ember-rails` is a dependency, just run your build as usual:

```bash
  ember build --environment=production
```

The RubyGem will be build into the `dist` directory with the name `ember-rails-<app name>`
matching the name and version you have specified in `package.json`

You can then distribute this package [privately](https://gemfury.com) or
[publicly](https://rubygems.org) and include it in your Rails app's Gemfile:

```ruby
  gem 'ember-rails-app-name'
```

The generated assets are now available to your Rails pages:

```erb
  <%= stylesheet_link_tag 'ember-rails-app-name/vendor' %>
  <%= stylesheet_link_tag 'ember-rails-app-name/application' %>
  ...
  <%= javascript_include_tag 'ember-rails-app-name/vendor' %>
  <%= javascript_include_tag 'ember-rails-app-name/application' %>
```

## Contribution and Improvements

Please submit an issue if we've missed some key functionality or you're seeing problems.
Better yet, fork the code, make the changes, and submit a pull request to speed things along.

### Submitting updates

If you would like to contribute to this project, just do the following:

1. Fork the repo on Github.
2. Add your features and make commits to your forked repo.
3. Make a pull request to this repo.
4. Review will be done and changes will be requested.
5. Once changes are done or no changes are required, pull request will be merged.
6. The next release will have your changes in it.

Please take a look at the issues page if you want to get started.
