require 'active_support/inflector'
require 'json'

module {{ pkgClass }}
  AppPath = '{{ pkgClass }}'.underscore
  AssetsPath = 'assets'

  class Engine < ::Rails::Engine
    initializer :assets do
      # Add helpers for javascript/stylesheets
      helper = Helper.new("{{ pkgClass }}", root)
      ActiveSupport.on_load( :action_view ) { include(helper) }

      # Add Ember application root to asset paths
      config = ::Rails.application.config
      assets = root.join(AssetsPath)

      # Serve directly when asset pipeline is enabled
      if config.public_file_server.enabled && config.assets.compile
        Rails.application.middleware.insert_after(::ActionDispatch::Static, Middleware, assets.to_s)
      end
    end
  end

  # Adding helper to reference paths
  class Helper < Module
    def initialize(name, root)
      manifest = IO.read(root.join('assetMap.json'))
      @assets = JSON.parse(manifest)['assets']
      @name = name
    end

    def included(klass)
      name, assets = @name.underscore, @assets
      define_method("#{name}_path") do |path|
        out = assets["#{AssetsPath}/#{path}"]
        raise("Path not found: #{path}") if !out
        out.sub(/^#{AssetsPath}/, "/#{AppPath}")
      end
    end
  end

  # Same as Static, but we strip "/<app>" prefix from path
  class Middleware < ::ActionDispatch::Static
    def call(env)
      prefix = "/#{AppPath}"
      req = Rack::Request.new env
      path = req.path_info

      if (req.get? || req.head?) && path.starts_with?(prefix)
        path = path.chomp("/").sub(/^#{prefix}/, '')
        if match = @file_handler.match?(path)
          req.path_info = match
          return @file_handler.serve(req)
        end
      end

      @app.call(req.env)
    end
  end
end
