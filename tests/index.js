var Controller = require('cerebral')
var Devtools = require('../')
var suite = {}
var async = function (cb) {
  setTimeout(cb, 0)
}
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

suite['should load devtools'] = function (test) {
  var controller = Controller(Model({}))

  controller.addModules({
    devtools: Devtools()
  })

  controller.getServices()
  test.equal(controller.getServices().devtools.store.getSignals().length, 0)
  test.done()
}

suite['should store details about signal and actions'] = function (test) {
  var ctrl = Controller(Model())
  ctrl.addModules({
    devtools: Devtools()
  })
  var signal = [
    function ActionA (context) { context.output({bar: true}) }
  ]

  ctrl.addSignals({
    'test': signal
  })
  ctrl.getSignals().test({
    foo: true
  })
  async(function () {
    var signal = ctrl.getServices().devtools.store.getSignals()[0]
    test.equal(signal.name, 'test')
    test.deepEqual(signal.branches[0].input, {foo: true})
    test.deepEqual(signal.branches[0].output, {bar: true})
    test.equal(signal.branches.length, 1)
    test.done()
  })
}

suite['should store details about actions'] = function (test) {
  var ctrl = Controller(Model())
  ctrl.addModules({
    devtools: Devtools()
  })
  var signal = [
    function ActionA () {}
  ]

  ctrl.addSignals({
    'test': signal
  })
  ctrl.getSignals().test({
    foo: true
  })

  async(function () {
    var action = ctrl.getServices().devtools.store.getSignals()[0].branches[0]
    test.equal(action.name, 'ActionA')
    test.equal(action.mutations.length, 0)
    test.done()
  })
}

suite['should store details about mutations'] = function (test) {
  var ctrl = Controller(Model())
  ctrl.addModules({
    devtools: Devtools()
  })
  var signal = [
    function ActionA (args) {
      args.state.set('foo', 'bar')
    }
  ]

  ctrl.addSignals({
    'test': signal
  })
  ctrl.getSignals().test()

  async(function () {
    var action = ctrl.getServices().devtools.store.getSignals()[0].branches[0]
    test.deepEqual(action.mutations[0], {
      name: 'set',
      path: ['foo'],
      args: ['bar']
    })
    test.done()
  })
}

suite['should store details about mutations correctly across sync and async signals'] = function (test) {
  var ctrl = Controller(Model())
  ctrl.addModules({
    devtools: Devtools()
  })
  var signalSync = [
    function ActionA (args) {
      args.state.set('foo', 'bar')
    }
  ]

  ctrl.addSignals({
    'test': signalSync
  })
  var signalAsync = [
    [
      function ActionB (args) { args.output() }
    ], function ActionC (args) {
      args.state.set('foo', 'bar')

      async(function () {
        var actionAsync = ctrl.getServices().devtools.store.getSignals()[0].branches[1]
        test.deepEqual(actionAsync.mutations[0], {
          name: 'set',
          path: ['foo'],
          args: ['bar']
        })

        var action = ctrl.getServices().devtools.store.getSignals()[0].branches[0][0].signals[0].branches[0]
        test.deepEqual(action.mutations[0], {
          name: 'set',
          path: ['foo'],
          args: ['bar']
        })
        test.done()
      })
    }
  ]
  ctrl.addSignals({
    'testAsync': signalAsync
  })
  ctrl.getSignals().testAsync()
  ctrl.getSignals().test()
}

suite['should wrap and track use of services'] = function (test) {
  var ctrl = Controller(Model())
  ctrl.addModules({
    devtools: Devtools()
  })

  var ModuleA = function (module) {
    function NoPrototype () {

    }

    NoPrototype.prototype = null

    var action = function (args) {
      args.services.moduleA.test('foo')
      args.services.moduleA.noPrototype('foo')
    }

    module.addServices({
      test: function () {

      },
      noPrototype: NoPrototype
    })

    module.addSignals({
      test: [action]
    })
  }

  var ModuleB = function (module) {
    var action = function (args) {
      args.services.moduleB.test('foo')
    }

    module.addServices({
      test: function () {

      }
    })

    module.addSignals({
      test: [action]
    })

    module.addModules({
      moduleC: ModuleC
    })
  }

  var ModuleC = function (module) {
    var action = function (args) {
      args.services.moduleB.moduleC.test('foo')
      args.services.moduleB.moduleC.test2.foo('foo')
      args.services.moduleB.moduleC.test2.bar('foo')
    }

    module.addServices({
      test: function () {

      },
      test2: {
        foo: function () {

        },
        bar: function () {

        },
        string: 'hey',
        array: []
      }
    })

    module.addSignals({
      test: [action]
    })
  }

  var ModuleD = function (module) {
    module.addServices({
      emitter: require('events').EventEmitter
    })
  }

  ctrl.addModules({
    moduleA: ModuleA,
    moduleB: ModuleB,
    moduleD: ModuleD
  })

  var assertModuleA = function (args) {
    test.ok(ctrl.getServices().moduleA.test)
    test.ok(ctrl.getServices().moduleA.noPrototype)
    test.equal(args.signal.branches[0].serviceCalls[0].name, 'moduleA')
    test.equal(args.signal.branches[0].serviceCalls[0].method, 'test')
    test.deepEqual(args.signal.branches[0].serviceCalls[0].args, ['foo'])
    test.equal(args.signal.branches[0].serviceCalls[1].name, 'moduleA')
    test.equal(args.signal.branches[0].serviceCalls[1].method, 'noPrototype')
    test.deepEqual(args.signal.branches[0].serviceCalls[1].args, ['foo'])
  }
  ctrl.on('signalEnd', assertModuleA)
  ctrl.getSignals().moduleA.test({}, {immediate: true})
  ctrl.removeListener('signalEnd', assertModuleA)

  var assertModuleB = function (args) {
    test.ok(ctrl.getServices().moduleB.test)
    test.equal(args.signal.branches[0].serviceCalls[0].name, 'moduleB')
    test.equal(args.signal.branches[0].serviceCalls[0].method, 'test')
    test.deepEqual(args.signal.branches[0].serviceCalls[0].args, ['foo'])
  }
  ctrl.on('signalEnd', assertModuleB)
  ctrl.getSignals().moduleB.test({}, {immediate: true})
  ctrl.removeListener('signalEnd', assertModuleB)

  var assertModuleC = function (args) {
    test.ok(ctrl.getServices().moduleB.moduleC.test)
    test.ok(ctrl.getServices().moduleB.moduleC.test2)
    test.equal(ctrl.getServices().moduleB.moduleC.test2.string, 'hey')
    test.deepEqual(ctrl.getServices().moduleB.moduleC.test2.array, [])

    test.equal(args.signal.branches[0].serviceCalls[0].name, 'moduleB.moduleC')
    test.equal(args.signal.branches[0].serviceCalls[0].method, 'test')
    test.deepEqual(args.signal.branches[0].serviceCalls[0].args, ['foo'])
  }
  ctrl.on('signalEnd', assertModuleC)
  ctrl.getSignals().moduleB.moduleC.test({}, {immediate: true})
  ctrl.removeListener('signalEnd', assertModuleC)

  test.done()
}

suite['should store isRouted and isRecorded options on the signal itself for the debugger'] = function (test) {
  var ctrl = Controller(Model())
  ctrl.addModules({
    devtools: Devtools()
  })
  var signal = [
    function () {}
  ]

  ctrl.addSignals({
    'test': {
      chain: signal,
      immediate: true
    }
  })
  ctrl.getSignals().test({}, {isRecorded: true, isRouted: true})
  test.ok(ctrl.getServices().devtools.store.getSignals()[0].isRecorded)
  test.ok(ctrl.getServices().devtools.store.getSignals()[0].isRouted)
  test.done()
}

suite['should NOT wrap and track use of special or nested services'] = function (test) {
  var ctrl = Controller(Model())
  ctrl.addModules({
    devtools: Devtools()
  })
  function MyClass () {

  }
  MyClass.prototype = {
    constructor: MyClass
  }

  function Extended () {

  }
  Extended.foo = 'bar'

  var moduleA = function (module) {
    module.addServices({
      MyClass: MyClass,
      nested: {
        foo: function () {

        },
        MyClass: MyClass,
        extended: Extended
      },
      extended: Extended
    })
  }

  var action = function (args) {
    args.services.moduleA.MyClass()
    args.services.moduleA.extended()
    args.services.moduleA.nested.foo()
    args.services.moduleA.nested.MyClass()
    args.services.moduleA.nested.extended()
  }

  ctrl.addSignals({
    signal: [action]
  })

  ctrl.addModules({
    moduleA: moduleA
  })

  var assertNoServicesWrapped = function (args) {
    test.ok(!args.signal.branches[0].serviceCalls.length)
    test.done()
  }
  ctrl.on('signalEnd', assertNoServicesWrapped)
  ctrl.getSignals().signal({}, {immediate: true})
}

module.exports = suite
