module {{ pkgClass }}
  class Engine < ::Rails::Engine
    initializer :assets do
      # Add Ember application root to asset paths
      config = ::Rails.application.config
      config.assets.paths << root.join('assets').to_s

      # Precompile app for standalone delivery
      config.assets.precompile += %w(
        application.css
        application.js
        vendor.css
        vendor.js
      ).map { |f| File.join("{{ pkgId }}", f) }
    end
  end
end
