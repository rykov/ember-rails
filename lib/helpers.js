var Handlebars = require("handlebars");

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
    out.id = Handlebars.compile(id)({ name: out.base });
    out.path = getPkgPath(out.id, opts.rootURL);
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

function getPkgPath(id, rootURL) {
  if(rootURL) {
    return rootURL.replace(/^\/+|\/+$/g, '');
  } else {
    return id.replace(/-/g, "_");
  }
}
