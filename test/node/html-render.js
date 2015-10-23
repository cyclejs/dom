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
    let [requests, responses] = Cycle.run(app, {html: makeHTMLDriver()});

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
    let [requests, responses] = Cycle.run(app, {html: makeHTMLDriver()});

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
    let [requests, responses] = Cycle.run(app, {html: makeHTMLDriver()});

    responses.html.subscribe(html => {
      assert.strictEqual(html, '<div class="test-element">Foobar</div>');
      done();
    });
  });

  it('should render a simple nested dialogue element as HTML', function (done) {
    function aDialogue() {
      return {
        DOM: Rx.Observable.of(h('h3.a-dialogue'))
      };
    }
    function app() {
      return {
        DOM: Rx.Observable.of(h('div.test-element', [aDialogue().DOM]))
      };
    }
    let [requests, responses] = Cycle.run(app, {DOM: makeHTMLDriver()});

    responses.DOM.subscribe(html => {
      assert.strictEqual(html,
        '<div class="test-element">' +
          '<h3 class="a-dialogue"></h3>' +
        '</div>'
      );
      done();
    });
  });

  it('should render double nested dialogues as HTML', function (done) {
    function aDialogue() {
      return {
        DOM: Rx.Observable.of(h('h3.a-dialogue'))
      };
    }
    function aNiceDialogue() {
      return {
        html: Rx.Observable.of(h('div.a-nice-dialogue', [
          String('foobar'), aDialogue().DOM
        ]))
      };
    }
    function app() {
      return {
        html: Rx.Observable.of(h('div.test-element', [aNiceDialogue().html]))
      };
    }
    let html$ = Cycle.run(app, {html: makeHTMLDriver()})[1].html;

    html$.subscribe(html => {
      assert.strictEqual(html,
        '<div class="test-element">' +
          '<div class="a-nice-dialogue">' +
            'foobar<h3 class="a-dialogue"></h3>' +
          '</div>' +
        '</div>'
      );
      done();
    });
  });

  it('should HTML-render a nested dialogue with props$', function (done) {
    function aDialogue(sources) {
      return {
        DOM: sources.props$
          .map(props => h('h3.a-dialogue', String(props.foobar).toUpperCase()))
      };
    }
    function app() {
      return {
        DOM: Rx.Observable.of(
          h('div.test-element', [
            aDialogue({props$: Rx.Observable.of({foobar: 'yes'})}).DOM
          ])
        )
      };
    }
    let [requests, responses] = Cycle.run(app, {DOM: makeHTMLDriver()});

    responses.DOM.subscribe(html => {
      assert.strictEqual(html,
        '<div class="test-element">' +
          '<h3 class="a-dialogue">YES</h3>' +
        '</div>'
      );
      done();
    });
  });

  it('should render a complex nested dialogue tree as HTML', function (done) {
    function xFoo() {
      return {
        html: Rx.Observable.of(h('h1.fooclass'))
      };
    }
    function xBar() {
      return {
        html: Rx.Observable.of(h('h2.barclass'))
      };
    }
    function app() {
      return {
        html: Rx.Observable.of(
          h('.test-element', [
            h('div', [
              h('h2.a', 'a'),
              h('h4.b', 'b'),
              xFoo().html
            ]),
            h('div', [
              h('h3.c', 'c'),
              h('div', [
                h('p.d', 'd'),
                xBar().html
              ])
            ])
          ])
        )
      };
    }
    let [requests, responses] = Cycle.run(app, {html: makeHTMLDriver()});

    responses.html.subscribe(html => {
      assert.strictEqual(html,
        '<div class="test-element">' +
          '<div>' +
            '<h2 class="a">a</h2>' +
            '<h4 class="b">b</h4>' +
            '<h1 class="fooclass"></h1>' +
          '</div>' +
          '<div>' +
            '<h3 class="c">c</h3>' +
            '<div>' +
              '<p class="d">d</p>' +
              '<h2 class="barclass"></h2>' +
            '</div>' +
          '</div>' +
        '</div>'
      );
      done();
    });
  });
});

