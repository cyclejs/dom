import {VNode} from 'snabbdom';

function setScope(elm: HTMLElement, data: any, scope: string) {
  if (data.ns) { // is SVG
    elm.setAttribute(`cycleIsolate`, scope);
  } else {
    (<any> elm).dataset.cycleIsolate = scope;
  }
}

function removeScope(elm: HTMLElement, data: any, scope: string) {
  if (data.ns) { // is SVG
    elm.removeAttribute(`cycleIsolate`);
  } else {
    delete (<any> elm).dataset.cycleIsolate;
  }
}

function update(oldVNode: VNode, vNode: VNode) {
  const {data: oldData = {}} = oldVNode;
  const {elm, data = {}} = vNode;

  const oldIsolate = oldData.isolate || ``;
  const isolate = data.isolate || ``;

  if (isolate && isolate !== oldIsolate) {
    setScope((<HTMLElement> elm), data, isolate);
  }
  if (oldIsolate && !isolate) {
    removeScope((<HTMLElement> elm), data, isolate);
  }
}

const IsolateModule: Object = {
  // init: (vNode) => update({}, vNode),
  create: update,
  update,
};

export {IsolateModule}
