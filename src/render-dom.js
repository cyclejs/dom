let Rx = require(`rx`)
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

    let prevVTree = wrapTopLevelVTree(oldVTree, rootElem)
    let nextVTree = wrapTopLevelVTree(newVTree, rootElem)
    /* eslint-disable */
    rootElem = VDOM.patch(rootElem, VDOM.diff(prevVTree, nextVTree))
    /* eslint-enable */
    return Rx.Observable.just(rootElem)
  }
}

function renderRawRootElem$(vtree$, domContainer) {
  let diffAndPatchToElement$ = makeDiffAndPatchToElement$(domContainer)
  return vtree$
    .flatMapLatest(transposeVTree)
    .startWith(VDOM.parse(domContainer))
    .pairwise()
    .flatMap(diffAndPatchToElement$)
}

function isolateSource(source, scope) {
  return source.select(`.cycle-scope-${scope}`)
}

function isolateSink(sink, scope) {
  return sink.map(vtree => {
    const {className: vtreeClass = ``} = vtree.properties
    if (vtreeClass.indexOf(`cycle-scope-${scope}`) === -1) {
      const c = `${vtreeClass} cycle-scope-${scope}`.trim()
      vtree.properties.className = c
    }
    if (vtree.properties.attributes) { // for svg root elements
      const vtreeAttrClass = vtree.properties.attributes[`class`] || ``
      if (vtreeAttrClass.indexOf(`cycle-scope-${scope}`) === -1) {
        const cattr = `${vtreeAttrClass} cycle-scope-${scope}`.trim()
        vtree.properties.attributes[`class`] = cattr
      }
    }
    return vtree
  })
}

function makeIsStrictlyInRootScope(namespace) {
  const classIsForeign = c => {
    const matched = c.match(/cycle-scope-(\S+)/)
    return matched && namespace.indexOf(`.${c}`) === -1
  }
  const classIsDomestic = c => {
    const matched = c.match(/cycle-scope-(\S+)/)
    return matched && namespace.indexOf(`.${c}`) !== -1
  }
  return function isStrictlyInRootScope(leaf) {
    for (let el = leaf; el; el = el.parentElement) {
      const split = String.prototype.split
      const classList = el.classList || split.call(el.className, ` `)
      if (Array.prototype.some.call(classList, classIsDomestic)) {
        return true
      }
      if (Array.prototype.some.call(classList, classIsForeign)) {
        return false
      }
    }
    return true
  }
}

const eventTypesThatDontBubble = [
  `load`,
  `unload`,
  `focus`,
  `blur`,
  `mouseenter`,
  `mouseleave`,
  `submit`,
  `change`,
  `reset`,
  `timeupdate`,
  `playing`,
  `waiting`,
  `seeking`,
  `seeked`,
  `ended`,
  `loadedmetadata`,
  `loadeddata`,
  `canplay`,
  `canplaythrough`,
  `durationchange`,
  `play`,
  `pause`,
  `ratechange`,
  `volumechange`,
  `suspend`,
  `emptied`,
  `stalled`,
]

function maybeMutateEventPropagationAttributes(event) {
  if (!event.hasOwnProperty(`propagationHasBeenStopped`)) {
    event.propagationHasBeenStopped = false
    const oldStopPropagation = event.stopPropagation
    event.stopPropagation = function stopPropagation() {
      oldStopPropagation.call(this)
      this.propagationHasBeenStopped = true
    }
  }
}

function mutateEventCurrentTarget(event, currentTargetElement) {
  try {
    Object.defineProperty(event, `currentTarget`, {
      value: currentTargetElement,
      configurable: true,
    })
  } catch (err) {
    void err // noop
  }
  event.ownerTarget = currentTargetElement
}

function makeSimulateBubbling(namespace, rootEl) {
  const isStrictlyInRootScope = makeIsStrictlyInRootScope(namespace)
  const descendantSel = namespace.join(` `)
  const topSel = namespace.join(``)
  const roof = rootEl.parentElement

  return function simulateBubbling(ev) {
    maybeMutateEventPropagationAttributes(ev)
    if (ev.propagationHasBeenStopped) {
      return false
    }
    for (let el = ev.target; el && el !== roof; el = el.parentElement) {
      if (!isStrictlyInRootScope(el)) {
        continue
      }
      if (matchesSelector(el, descendantSel) || matchesSelector(el, topSel)) {
        mutateEventCurrentTarget(ev, el)
        return true
      }
    }
    return false
  }
}

function makeEventsSelector(rootEl$, namespace) {
  return function events(eventName, options = {}) {
    if (typeof eventName !== `string`) {
      throw new Error(`DOM driver's events() expects argument to be a ` +
        `string representing the event type to listen for.`)
    }
    let useCapture = false
    if (eventTypesThatDontBubble.indexOf(eventName) !== -1) {
      useCapture = true
    }
    if (typeof options.useCapture === `boolean`) {
      useCapture = options.useCapture
    }

    return rootEl$
      .first()
      .flatMapLatest(rootEl => {
        if (!namespace || namespace.length === 0) {
          return fromEvent(rootEl, eventName, useCapture)
        }
        const simulateBubbling = makeSimulateBubbling(namespace, rootEl)
        return fromEvent(rootEl, eventName, useCapture).filter(simulateBubbling)
      })
      .share()
  }
}

const isValidString = param => typeof param === `string` && param.length > 0

const contains = (str, match) => str.indexOf(match) > -1

const isNotTagName = param =>
    isValidString(param) && contains(param, `.`) ||
    contains(param, `#`) || contains(param, `:`)

function sortNamespace(a, b) {
  if (isNotTagName(a) && isNotTagName(b)) {
    return 0
  }
  return isNotTagName(a) ? 1 : -1
}

function removeDuplicates(arr) {
  const newArray = []
  arr.forEach((element) => {
    if (newArray.indexOf(element) === -1) {
      newArray.push(element)
    }
  })
  return newArray
}

const getScope = namespace =>
  namespace.filter(c => c.indexOf(`.cycle-scope`) > -1)

function makeFindElements(namespace) {
  return function findElements(rootElement) {
    if (namespace.join(``) === ``) {
      return rootElement
    }
    const slice = Array.prototype.slice
    const scope = getScope(namespace)
    // Uses universal selector && is isolated
    if (namespace.indexOf(`*`) > -1 && scope.length > 0) {
      // grab top-level boundary of scope
      const topNode = rootElement.querySelector(scope.join(` `))

      if (!topNode) {
        return []
      }
      // grab all children
      const childNodes = topNode.getElementsByTagName(`*`)
      return removeDuplicates(
        [topNode].concat(slice.call(childNodes))
      ).filter(makeIsStrictlyInRootScope(namespace))
    }

    return removeDuplicates(
      slice.call(
        rootElement.querySelectorAll(namespace.join(` `))
      ).concat(slice.call(
        rootElement.querySelectorAll(namespace.join(``))
      ))
    ).filter(makeIsStrictlyInRootScope(namespace))
  }
}

function makeElementSelector(rootElement$) {
  return function elementSelector(selector) {
    if (typeof selector !== `string`) {
      throw new Error(`DOM driver's select() expects the argument to be a ` +
        `string as a CSS selector`)
    }

    const namespace = this.namespace
    const trimmedSelector = selector.trim()
    const childNamespace = trimmedSelector === `:root` ?
      namespace :
      namespace.concat(trimmedSelector).sort(sortNamespace)

    return {
      observable: rootElement$.map(makeFindElements(childNamespace)),
      namespace: childNamespace,
      select: makeElementSelector(rootElement$),
      events: makeEventsSelector(rootElement$, childNamespace),
      isolateSource,
      isolateSink,
    }
  }
}

function validateDOMSink(vtree$) {
  if (!vtree$ || typeof vtree$.subscribe !== `function`) {
    throw new Error(`The DOM driver function expects as input an ` +
      `Observable of virtual DOM elements`)
  }
}

function defaultOnErrorFn(msg) {
  if (console && console.error) {
    console.error(msg)
  } else {
    console.log(msg)
  }
}

function makeDOMDriver(container, options) {
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
  const {onError = defaultOnErrorFn} = options || {}
  if (typeof onError !== `function`) {
    throw new Error(`You provided an \`onError\` to makeDOMDriver but it was ` +
      `not a function. It should be a callback function to handle errors.`)
  }

  return function domDriver(vtree$) {
    validateDOMSink(vtree$)
    let rootElem$ = renderRawRootElem$(vtree$, domContainer)
      .startWith(domContainer)
      .doOnError(onError)
      .replay(null, 1)
    let disposable = rootElem$.connect()
    return {
      observable: rootElem$,
      namespace: [],
      select: makeElementSelector(rootElem$),
      events: makeEventsSelector(rootElem$, []),
      dispose: () => disposable.dispose(),
      isolateSource,
      isolateSink,
    }
  }
}

module.exports = {
  isElement,
  wrapTopLevelVTree,
  makeDiffAndPatchToElement$,
  renderRawRootElem$,
  validateDOMSink,

  makeDOMDriver,
}
