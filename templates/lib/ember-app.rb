require 'active_support/inflector'
require 'json'

module {{ pkgClass }}
  AppPath = '{{ pkgPath }}'
  PublicPath = 'public'

  class Engine < ::Rails::Engine
    initializer :assets do
      # Add helpers for javascript/stylesheets
      helper = Helper.new("{{ pkgClass }}", root)
      ActiveSupport.on_load( :action_view ) { include(helper) }

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

  # Adding helper to reference paths
  class Helper < Module
    def initialize(name, root)
      manifest = JSON.parse(IO.read(root.join('assetMap.json')))
      @assets = manifest['assets']
      @prefix = "/#{AppPath}/"
      @name = name
    end

    def included(klass)
      name = @name.underscore
      assets, prefix = @assets, @prefix

      define_method("#{name}_path") do |path|
        out = assets[path] || raise("Path not found: #{path}")
        asset_path("#{prefix}#{out}")
      end
    end
  end

  # Same as Static, but we strip "/<app>" prefix from path
  class Middleware < ::ActionDispatch::Static
    PathPrefix = "/#{AppPath}"

    def call(env)
      req = Rack::Request.new env
      path = req.path_info

      if (req.get? || req.head?) && path.starts_with?(PathPrefix)
        path = path.chomp("/").sub(/^#{PathPrefix}/, '')
        if match = @file_handler.match?(path)
          req.path_info = match
          return @file_handler.serve(req)
        end
      end

      @app.call(req.env)
    end
  end
end
