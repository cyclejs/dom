'use strict';
/* global describe, it, beforeEach */
let assert = require('assert');
let Cycle = require('@cycle/core');
let CycleDOM = require('../../src/cycle-dom');
let Rx = require('@reactivex/rxjs');
let {h, makeHTMLDriver} = CycleDOM;

describe('HTML Driver', function () {
  it('should output HTML when given a simple vtree stream', function (done) {
    function app() {
      return {
        html: Rx.Observable.of(h('div.test-element', ['Foobar']))
      };
    }
    let [requests, responses] = Cycle.run(app, {
      html: makeHTMLDriver()
    });
    responses.html.subscribe(html => {
      assert.strictEqual(html, '<div class="test-element">Foobar</div>');
      done();
    });
  });

  it('should make bogus select().events() as requests', function (done) {
    function app({html}) {
      assert.strictEqual(typeof html.select, 'function');
      assert.strictEqual(typeof html.select('whatever').observable.subscribe, 'function');
      assert.strictEqual(typeof html.select('whatever').events().subscribe, 'function');
      return {
        html: Rx.Observable.of(h('div.test-element', ['Foobar']))
      };
    }
    let [requests, responses] = Cycle.run(app, {
      html: makeHTMLDriver()
    });
    responses.html.subscribe(html => {
      assert.strictEqual(html, '<div class="test-element">Foobar</div>');
      done();
    });
  });

  it('should output simple HTML Observable at `.get(\':root\')`', function (done) {
    function app() {
      return {
        html: Rx.Observable.of(h('div.test-element', ['Foobar']))
      };
    }
    let [requests, responses] = Cycle.run(app, {
      html: makeHTMLDriver()
    });
    responses.html.subscribe(html => {
      assert.strictEqual(html, '<div class="test-element">Foobar</div>');
      done();
    });
  });
});
