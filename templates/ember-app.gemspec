# coding: utf-8
Gem::Specification.new do |spec|
  spec.name          = "{{ pkgId }}"
  spec.version       = "{{ pkg.version }}"
  spec.authors       = ["{{ pkg.author }}"]
  spec.email         = ["support@gemfury.com"]
  spec.summary       = %q{Ember app "{{ pkg.name }}"}
  spec.description   = %q{Ember application "{{ pkg.name }}"}
  spec.homepage      = "{{ pkg.homepage }}"
  spec.license       = "{{ pkg.license }}"

  spec.files         = Dir["{app,lib,public}/**/*"]

  spec.require_paths = ["lib"]
  spec.add_dependency "railties", ">= 4.0"
end
