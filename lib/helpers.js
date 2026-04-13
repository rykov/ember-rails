const Handlebars = require("handlebars");

module.exports = {
  // Generate common package metadata
  //   return {
  //     id:    'ember-app-name',
  //     base:  'sanitized-app-name',
  //     class: 'EmberRailsAppName',
  //     path:  'ember_app_name',
  //   }

  getPackageMeta(name, opts) {
    const id = opts.id || '{{ name }}';
    const out = { base: name.replace(/[^\w-_]/g, '') };
    out.id = Handlebars.compile(id)({ name: out.base });
    out.path = getPkgPath(out.id, opts.rootURL);
    out.class = getPkgClassName(out.id);
    return out;
  }
}

const getPkgClassName = (name) => {
  name = (name || '').replace(/[\W_]/g, ' ');
  return name.replace(/\b(.)?/g, (m, c) => {
    return c ? c.toUpperCase() : "";
  }).replace(/\s/g, '');
};

const getPkgPath = (id, rootURL) => {
  if(rootURL) {
    return rootURL.replace(/^\/+|\/+$/g, '');
  } else {
    return id.replace(/-/g, "_");
  }
};
