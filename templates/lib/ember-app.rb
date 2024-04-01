require 'active_support/inflector'
require 'json'

module {{ pkgClass }}
  AppPath = '{{ pkgPath }}'
  PublicPath = 'public'

  class Engine < ::Rails::Engine
    initializer "{{ pkgClass }}.assets", after: :assets do
      # Add helpers for javascript/stylesheets
      helper = Helper.new("{{ pkgClass }}", root)
      ActiveSupport.on_load( :action_view ) { include(helper) }

      # Add helper methods to application's controller
      controller_ext = ControllerExt.new("{{ pkgClass }}")
      ActiveSupport.on_load(:action_controller_base) {
        prepend(controller_ext)
      }

      # Add Ember application root to asset paths
      config = ::Rails.application.config
      assets = root.join(PublicPath)

      # Serve directly when asset pipeline is enabled
      if config.public_file_server.enabled && config.assets.compile
        Rails.application.middleware.insert_after(::ActionDispatch::Static, Middleware, assets.to_s)
      end
    end

    # Tasks to copy assets from this gem to "public" folder
    rake_tasks do
      load __FILE__.sub(/\.rb$/, '.rake')
    end
  end

  # Adding helper to load app
  class ControllerExt < Module
    def initialize(name)
      @name = name
    end

    def prepended(klass)
      name = @name.underscore

      define_method("render_#{name}") do
        render layout: "#{name}/boot", inline: ''
      end
    end
  end

  # Adding helper to reference paths
  class Helper < Module
    def initialize(name, root)
      manifest1 = load_json(root, 'assetMap.json', 'assets')
      manifest2 = load_json(root, 'assetManifest.json')
      @entrypoints = manifest2['entrypoints']['app']
      @assets = manifest1.merge(manifest2['assets'])
      @prefix = "/#{AppPath}/"
      @name = name
    end

    def included(klass)
      std_paths = %w(vendor {{ pkgName }})
      assets, prefix = @assets, @prefix
      name = @name.underscore

      entry_map = @entrypoints.map { |p| "#{prefix}assets/#{p}" }
      entry_map = entry_map.group_by { |p| File.extname(p) }
      entry_map.default = [] # See below for usage

      define_method("#{name}_path") do |path|
        out = assets[path] || raise("Path not found: #{path}")
        asset_path("#{prefix}#{out}")
      end

      define_method("stylesheet_link_#{name}") do
        safe_join(std_paths.map { |path|
          send("#{name}_path", "assets/#{path}.css")
        }.insert(1, *entry_map['.css']).map { |path|
          stylesheet_link_tag(path)
        }, "\n")
      end

      define_method("javascript_include_#{name}") do
        safe_join(std_paths.map { |path|
          send("#{name}_path", "assets/#{path}.js")
        }.insert(1, *entry_map['.js']).map { |path|
          javascript_include_tag(path)
        }, "\n")
      end
    end

  private

    def load_json(root, filePath, jsonPath = nil)
      hash = JSON.parse(IO.read(root.join(filePath)))
      (jsonPath ? hash[jsonPath] : hash) || {}
    rescue Errno::ENOENT
      {}
    end
  end

  # Same as Static, but we strip "/<app>" prefix from path
  class Middleware
    PathPrefix = "/#{AppPath}"

    def initialize(app, *args)
      @static = ::ActionDispatch::Static.new(app, *args)
      @app = app
    end

    def call(env)
      path = env[Rack::PATH_INFO] || '/'
      verb = env[Rack::REQUEST_METHOD]

      if (verb == "GET" || verb == "HEAD") && path.starts_with?(PathPrefix)
        path = path.chomp("/").sub(/^#{PathPrefix}/, '')
        @static.call(env.merge(Rack::PATH_INFO => path))
      else
        @app.call(env)
      end
    end
  end
end
