require 'active_support/inflector'

module {{ pkgClass }}
  AppPath = '{{ pkgPath }}'
  PublicPath = 'public'

  class Engine < ::Rails::Engine
    initializer "{{ pkgClass }}.assets", after: :assets do
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

      define_method("render_#{name}") do |*args, &block|
        opts = args.extract_options!.dup
        opts[:inline] = '' if args.empty? && opts.empty?
        args.push(opts.merge(layout: "#{name}/boot"))
        render(*args, &block)
      end
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
