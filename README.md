# Rails Asset Wrapper for Ember CLI apps

[![npm version](https://badge.fury.io/js/ember-cli-rails.svg)](https://badge.fury.io/js/ember-cli-rails)

This is an Ember addon to build a Rails Asset wrapper for your Ember application which can then
be included as a RubyGem **without other dependencies** in your Rails application.

## Demo

This package was used to deploy the landing page on [Version Badge](https://badge.fury.io/)

## Getting started

If you are using Ember CLI, simply install `ember-cli-rails` as a dev dependency of your
application's `package.json`:

```bash
  npm install ember-cli-rails --save-dev
```

## Usage

Once `ember-cli-rails` is a dependency, just run your build as usual:

```bash
  ember build --environment=production
```

The RubyGem will be built into the `dist-rails` directory with the name `ember-<app name>`
matching the name and version you have specified in `package.json`

You can then distribute this package [privately](https://gemfury.com) or
[publicly](https://rubygems.org) and include it in your Rails app's Gemfile:

```ruby
  gem 'ember-app-name'
```

### Rendering the Ember app

The generated gem adds a `render_<app_name>` helper to your Rails controllers:

```ruby
  class EmberController < ActionController::Base
    def index
      render_ember_app_name
    end
  end
```

This renders the Ember app's boot HTML, which includes all necessary script and
stylesheet tags.

The helper accepts the same arguments as Rails `render`, so, for example, you can
customize the boot HTML by passing a template that uses `content_for` to inject
content into the layout's `yield` blocks:

```ruby
  render_ember_app_name 'customizations'
```

```erb
  <%# app/views/ember/customizations.html.erb %>
  <% content_for :head do %>
    <meta name="custom-config" content="value">
  <% end %>

  <p>Loading...</p>
```

The template's `content_for` blocks are yielded into the corresponding
placeholders in the boot layout (e.g. `:head`, `:body-footer`), and the
template body itself is rendered into the main `<%= yield %>` block.

### Serving assets directly

The generated gem includes Rack middleware that serves your Ember app's assets
under the app path prefix. In development, you can also serve assets directly
by enabling the public file server and asset compilation:

```ruby
  # config/environments/development.rb
  config.public_file_server.enabled = true
  config.assets.compile = true
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
