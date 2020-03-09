var mustache = require("mustache");

module.exports = {
  // Generate common package metadata
  //   return {
  //     id:    'ember-app-name',
  //     base:  'sanitized-app-name',
  //     class: 'EmberRailsAppName',
  //     path:  'ember_app_name',
  //   }

  getPackageMeta: function(name, opts) {
    var id = opts.id || '{{ name }}';
    var out = { base: name.replace(/[^\w-_]/g, '') };
    out.id = mustache.render(id, { name: out.base });
    out.path = out.id.replace(/-/g, "_");
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
