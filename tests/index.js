var Controller = require('cerebral')
var Devtools = require('../')

global.window = {
  addEventListener: function () {},
  dispatchEvent: function () {},
  chrome: true
}
global.CustomEvent = function () {}

global.document = {
  addEventListener: function () {}
}

var Model = function () {
  return function () {
    return {
      mutators: {
        set: function (path, value) {
          var state = {}
          state[path.pop()] = value
        }
      }
    }
  }
}

exports['should load devtools'] = function (test) {
  var controller = Controller(Model({}))

  controller.addModules({
    devtools: Devtools()
  })

  controller.getServices()
  test.equal(controller.getServices().devtools.store.getSignals().length, 0)
  test.done()
}
