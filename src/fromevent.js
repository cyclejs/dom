let Rx = require(`@reactivex/rxjs`)

function createListener({element, eventName, handler, useCapture}) {
  if (element.addEventListener) {
    element.addEventListener(eventName, handler, useCapture)
    return new Rx.Subscription(() =>
      element.removeEventListener(eventName, handler, useCapture)
    )
  }
  throw new Error(`No listener found`)
}

function createEventListener({element, eventName, handler, useCapture}) {
  const disposables = new Rx.Subscription()

  const toStr = Object.prototype.toString
  if (toStr.call(element) === `[object NodeList]` ||
    toStr.call(element) === `[object HTMLCollection]`)
  {
    for (let i = 0, len = element.length; i < len; i++) {
      disposables.add(createEventListener({
          element: element.item(i),
          eventName,
          handler,
          useCapture}))
    }
  } else if (element) {
    disposables.add(createListener({element, eventName, handler, useCapture}))
  }
  return disposables
}

function fromEvent(element, eventName, useCapture = false) {
  return Rx.Observable.create(function subscribe(observer) {
    return createEventListener({
      element,
      eventName,
      handler: function handler() {
        observer.next(arguments[0])
      },
      useCapture})
  }).publish().refCount()
}

module.exports = fromEvent
