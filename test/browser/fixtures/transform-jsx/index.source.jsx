let Rx = require('rx');

function app() {
  return {
    DOM: Rx.Observable.just(
      <select className="my-class">
        <option value="foo">Foo</option>
        <option value="bar">Bar</option>
        <option value="baz">Baz</option>
      </select>
    )
  };
}

module.exports = app
