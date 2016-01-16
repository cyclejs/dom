var h = require("./src/virtual-hyperscript");

/**
 * Constructor function for https://www.npmjs.com/package/babel-plugin-transform-jsx
 * Docs are in ./src/cycle-dom
 */
module.exports = function (jsxObject) {
  return h(
    jsxObject.elementName,
    jsxObject.attributes,
    jsxObject.children
  )
}
