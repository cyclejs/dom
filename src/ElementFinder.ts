interface MatchesSelector {
  (element: Element, selector: string): boolean;
}
let matchesSelector: MatchesSelector;
declare var require: any;
try {
  matchesSelector = require(`matches-selector`);
} catch (e) {
  matchesSelector = <MatchesSelector> Function.prototype;
}

import {ScopeChecker} from './ScopeChecker';

function getScope(namespace: Array<string>): Array<string> {
  return namespace.filter(c => c.indexOf(`[data-cycle-isolate=`) > -1);
}

function getSelectors(namespace: Array<string>): Array<string> {
  return namespace.filter(c => c.indexOf(`[data-cycle-isolate=`) === -1);
}

function toElArray(input: any): Array<Element> {
  return <Array<Element>> Array.prototype.slice.call(input);
}

export class ElementFinder {
  constructor(public namespace: Array<string>) {
  }

  call(rootElement: Element): Element | Array<Element> {
    const namespace = this.namespace;
    if (namespace.join(``) === ``) {
      return rootElement;
    }
    const scopeChecker = new ScopeChecker(namespace);
    const scope = getScope(namespace).join(` `);

    const selector = getSelectors(namespace).join(` `);
    let topNode = rootElement;
    let topNodeMatches: Array<Element> = [];

    if (scope.length > 0) {
      topNode = rootElement.querySelector(scope) || rootElement;
      if (matchesSelector(topNode, selector)) {
        topNodeMatches.push(topNode);
      }
    }

    return toElArray(topNode.querySelectorAll(selector))
        .concat(topNodeMatches)
        .filter(scopeChecker.isStrictlyInRootScope, scopeChecker);
  }
}
