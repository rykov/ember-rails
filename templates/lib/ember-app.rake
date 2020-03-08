require 'fileutils'

app_path = '{{ pkgClass }}'.underscore
task_name = "prepare_{{ pkgClass }}"

namespace :assets do
  task :"#{task_name}" do
    config = ::Rails.application.config
    dst = File.join(config.paths['public'].first, app_path)
    src = File.expand_path("../../assets", __FILE__)
    FileUtils.rm_r(dst) if File.exist?(dst)
    FileUtils.cp_r(src, dst)
  end
end

if Rake::Task.task_defined?("assets:precompile")
  Rake::Task['assets:precompile'].enhance(["assets:#{task_name}"])
end
