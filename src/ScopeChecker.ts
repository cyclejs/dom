export class ScopeChecker {
  constructor(private namespace: Array<string>) {
  }

  private getIsolate(el: HTMLElement) {
    if (el instanceof SVGElement) {
      return el.getAttribute(`cycle-isolate`);
    }
    return (<any> el).dataset.cycleIsolate || null;
  }

  private checkNamespace(selector: string) {
    return this.namespace.indexOf(selector);
  }

  public isStrictlyInRootScope(leaf: HTMLElement): boolean {
    for (let el = leaf; el; el = el.parentElement) {
      const isolate = this.getIsolate(el);
      const selector = `[data-cycle-isolate="${isolate}"]`;
      if (isolate && this.checkNamespace(selector) === -1) {
        return false;
      }
      if (isolate && this.checkNamespace(selector) !== -1) {
        return true;
      }
    }
    return true;
  }
}
