// jshint esnext: true, node: true

const vm = require("vm");
const fs = require("fs");

// TODO: cache script

module.exports = function(path, context) {
  context = context || {};
  var data = fs.readFileSync(path);
  vm.runInNewContext(data, context, path);
  return context;
};

