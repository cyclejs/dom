let Rx = require(`@reactivex/rxjs`)
let VirtualNode = require(`virtual-dom/vnode/vnode`)

/**
 * Converts a tree of VirtualNode|Observable<VirtualNode> into
 * Observable<VirtualNode>.
 */
function transposeVTree(vtree) {
  if (typeof vtree.subscribe === `function`) {
    return vtree.flatMap(transposeVTree)
  } else if (vtree.type === `VirtualText`) {
    return Rx.Observable.of(vtree)
  } else if (vtree.type === `VirtualNode` && Array.isArray(vtree.children) &&
    vtree.children.length > 0)
  {
    const transposedChildren = vtree.children.map(transposeVTree)
    return Rx.Observable
      .combineLatest(...transposedChildren, (...arr) =>
        new VirtualNode(
          vtree.tagName, vtree.properties, arr, vtree.key, vtree.namespace
        )
      )
  } else if (vtree.type === `VirtualNode` ||
    vtree.type === `Widget` ||
    vtree.type === `Thunk`)
  {
    return Rx.Observable.of(vtree)
  } else {
    throw new Error(`Unhandled case in transposeVTree()`)
  }
}

module.exports = {
  transposeVTree,
}
