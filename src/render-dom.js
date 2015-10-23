let Rx = require(`@reactivex/rxjs`)
let fromEvent = require(`./fromevent`)
let VDOM = {
  h: require(`./virtual-hyperscript`),
  diff: require(`virtual-dom/diff`),
  patch: require(`virtual-dom/patch`),
  parse: typeof window !== `undefined` ? require(`vdom-parser`) : () => {},
}
let {transposeVTree} = require(`./transposition`)
let matchesSelector
// Try-catch to prevent unnecessary import of DOM-specifics in Node.js env:
try {
  matchesSelector = require(`matches-selector`)
} catch (err) {
  matchesSelector = () => {}
}

function isElement(obj) {
  return typeof HTMLElement === `object` ?
    obj instanceof HTMLElement || obj instanceof DocumentFragment : //DOM2
    obj && typeof obj === `object` && obj !== null &&
    (obj.nodeType === 1 || obj.nodeType === 11) &&
    typeof obj.nodeName === `string`
}

function wrapTopLevelVTree(vtree, rootElem) {
  const {id: vtreeId = ``} = vtree.properties
  const {className: vtreeClass = ``} = vtree.properties
  const sameId = vtreeId === rootElem.id
  const sameClass = vtreeClass === rootElem.className
  const sameTagName = vtree.tagName.toUpperCase() === rootElem.tagName
  if (sameId && sameClass && sameTagName) {
    return vtree
  }
  let attrs = {}
  if (rootElem.id) { attrs.id = rootElem.id }
  if (rootElem.className) { attrs.className = rootElem.className }
  return VDOM.h(rootElem.tagName, attrs, [vtree])
}

function makeDiffAndPatchToElement$(rootElem) {
  return function diffAndPatchToElement$([oldVTree, newVTree]) {
    if (typeof newVTree === `undefined`) { return Rx.Observable.empty() }

    //let isCustomElement = isRootForCustomElement(rootElem)
    //let k = isCustomElement ? ' is custom element ' : ' is top level'
    let prevVTree = wrapTopLevelVTree(oldVTree, rootElem)
    let nextVTree = wrapTopLevelVTree(newVTree, rootElem)
    //console.log('%cVDOM diff and patch START' + k, 'color: #636300')
    /* eslint-disable */
    rootElem = VDOM.patch(rootElem, VDOM.diff(prevVTree, nextVTree))
    /* eslint-enable */
    //console.log('%cVDOM diff and patch END' + k, 'color: #636300')
    //console.log('%crawRootElem$ waiting children.' + k, 'color: #008800')
    return Rx.Observable.of(rootElem)
  }
}

function renderRawRootElem$(vtree$, domContainer) {
  let diffAndPatchToElement$ = makeDiffAndPatchToElement$(domContainer)
  return vtree$
    .switchMap(transposeVTree)
    .startWith(VDOM.parse(domContainer))
    .bufferCount(2)
    .flatMap(diffAndPatchToElement$)
}

function makeEventsSelector(element$) {
  return function events(eventName, useCapture = false) {
    if (typeof eventName !== `string`) {
      throw new Error(`DOM driver's get() expects second argument to be a ` +
        `string representing the event type to listen for.`)
    }
    return element$.switchMap(element => {
      if (!element) {
        return Rx.Observable.empty()
      }
      return fromEvent(element, eventName, useCapture)
    }).share()
  }
}

function makeElementSelector(rootElem$) {
  return function select(selector) {
    if (typeof selector !== `string`) {
      throw new Error(`DOM driver's select() expects first argument to be a ` +
        `string as a CSS selector`)
    }
    let element$ = selector.trim() === `:root` ? rootElem$ :
      rootElem$.map(rootElem => {
        if (matchesSelector(rootElem, selector)) {
          return rootElem
        } else {
          return rootElem.querySelectorAll(selector)
        }
      })
    return {
      observable: element$,
      events: makeEventsSelector(element$),
    }
  }
}

function validateDOMDriverInput(vtree$) {
  if (!vtree$ || typeof vtree$.subscribe !== `function`) {
    throw new Error(`The DOM driver function expects as input an ` +
      `Observable of virtual DOM elements`)
  }
}

function makeDOMDriver(container) {
  // Find and prepare the container
  let domContainer = typeof container === `string` ?
    document.querySelector(container) :
    container
  // Check pre-conditions
  if (typeof container === `string` && domContainer === null) {
    throw new Error(`Cannot render into unknown element \`${container}\``)
  } else if (!isElement(domContainer)) {
    throw new Error(`Given container is not a DOM element neither a selector ` +
      `string.`)
  }

  return function domDriver(vtree$) {
    validateDOMDriverInput(vtree$)
    let rootElem$ = renderRawRootElem$(vtree$, domContainer)
      .startWith(domContainer)
      .multicast(() => new Rx.ReplaySubject(1))
    let subscriber = rootElem$.connect()
    return {
      select: makeElementSelector(rootElem$),
      unsubscribe: () => subscriber.unsubscribe(),
    }
  }
}

module.exports = {
  isElement,
  wrapTopLevelVTree,
  makeDiffAndPatchToElement$,
  renderRawRootElem$,
  validateDOMDriverInput,

  makeDOMDriver,
}
