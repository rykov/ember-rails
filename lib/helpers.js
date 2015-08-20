module.exports = {
  // Generate common package metadata
  //   return {
  //     base:  'sanitized-app-name',
  //     id:    'ember-rails-app-name',
  //     class: 'EmberRailsAppName'
  //   }

  getPackageMeta: function(name, idPrefix) {
    var out = { base: name.replace(/[^\w-_]/g, '') };
    out.id = (idPrefix || '') + out.base;
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
