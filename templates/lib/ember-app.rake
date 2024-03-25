require 'fileutils'

task_name = "prepare_{{ pkgClass }}"
app_path = '{{ pkgPath }}'

namespace :assets do
  task :"#{task_name}" do
    config = ::Rails.application.config
    dst = File.join(config.paths['public'].first, app_path)
    src = File.expand_path("../../public", __FILE__)
    FileUtils.rm_r(dst) if File.exist?(dst)
    FileUtils.mkdir_p(File.dirname(dst))
    FileUtils.cp_r(src, dst)
  end
end

if Rake::Task.task_defined?("assets:precompile")
  Rake::Task['assets:precompile'].enhance(["assets:#{task_name}"])
end
