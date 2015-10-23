let Rx = require(`@reactivex/rxjs`)
let toHTML = require(`vdom-to-html`)
let {transposeVTree} = require(`./transposition`)

function makeResponseGetter() {
  return function get(selector) {
    if (console && console.log) {
      console.log(`WARNING: HTML Driver's get(selector) is deprecated.`)
    }
    if (selector === `:root`) {
      return this
    } else {
      return Rx.Observable.empty()
    }
  }
}

function makeBogusSelect() {
  return function select() {
    return {
      observable: Rx.Observable.empty(),
      events() {
        return Rx.Observable.empty()
      },
    }
  }
}

function makeHTMLDriver() {
  return function htmlDriver(vtree$) {
    let output$ = vtree$.switchMap(transposeVTree).last().map(toHTML)
    output$.get = makeResponseGetter()
    output$.select = makeBogusSelect()
    return output$
  }
}

module.exports = {
  makeHTMLDriver,
}
