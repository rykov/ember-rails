var mustache = require("mustache");

module.exports = {
  // Generate common package metadata
  //   return {
  //     base:  'sanitized-app-name',
  //     id:    'ember-rails-app-name',
  //     class: 'EmberRailsAppName'
  //   }

  getPackageMeta: function(name, opts) {
    var id = opts.id || '{{ name }}';

    // Backward compatibility with 1.0.2
    if(opts.idPrefix) {
      console.log("DEPRECATION: Use `id` template instead of `idPrefix`");
      id = opts.idPrefix + '{{ name }}';
    }

    var out = { base: name.replace(/[^\w-_]/g, '') };
    out.id = mustache.render(id, { name: out.base });
    out.class = getPkgClassName(out.id);
    return out;
  }
}

function getPkgClassName(name) {
  name = (name || '').replace(/[\W_]/g, ' ');
  return name.replace(/\b(.)?/g, function(m, c) {
    return c ? c.toUpperCase() : "";
  }).replace(/\s/g, '');
}
