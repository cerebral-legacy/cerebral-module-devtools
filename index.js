/* eslint-env browser*/
var SignalStore = require('cerebral-module-signal-store')
var utils = require('./utils')
var requestAnimationFrame = requestAnimationFrame || function (cb) { setTimeout(cb) }
var staticTree = require('cerebral/src/staticTree')

module.exports = function Devtools () {
  if (typeof window === 'undefined') { return function () {} }
  if (typeof window.chrome === 'undefined') { return function () {} }

  return function init (module, controller) {
    if (controller.addContextProvider) {
      controller.addContextProvider(require('./providers/actionServicesCallsProvider'))
      controller.addContextProvider(require('./providers/actionOutputProvider'))
      controller.addContextProvider(require('./providers/actionInputProvider'))
      controller.addContextProvider(require('./providers/signalOptionsProvider'))
    }

    module.addModules({
      store: SignalStore()
    })

    module.addSignals({
      modelChanged: [
        function changeModel (arg) {
          arg.state.set(arg.input.path, arg.input.value)
        }
      ]
    })

    var signalStore = controller.getServices()[module.name].store

    var isInitialized = false
    var hasInitialPayload = false
    var disableDebugger = false
    var willKeepState = false
    var APP_ID = String(Date.now())
    var VERSION = 'v3'
    var isAwaitingFrame = false
    var nextSignalInLine = 0

    var hasExecutingSignal = function (signal) {
      function traverseSignals (signals) {
        return signals.reduce(function (hasExecutingSignal, signal) {
          if (hasExecutingSignal || signal.isExecuting) {
            return true
          }

          return traverseChain(signal.branches)
        }, false)
      }

      function traverseChain (chain) {
        return chain.reduce(function (hasExecutingSignal, action) {
          if (hasExecutingSignal) {
            return true
          }

          if (Array.isArray(action)) {
            return traverseChain(action)
          }

          return traverseAction(action)
        }, false)
      }

      function traverseAction (action) {
        var hasExecutingSignal = false
        if (action.outputPath) {
          hasExecutingSignal = traverseChain(action.outputs[action.outputPath])
        }
        if (action.signals) {
          hasExecutingSignal = hasExecutingSignal || traverseSignals(action.signals)
        }
        return hasExecutingSignal
      }

      if (signal.isExecuting) {
        return true
      }

      return traverseChain(signal.branches)
    }

    var getOldestExecutingSignalIndex = function (signals, fromIndex) {
      for (var x = fromIndex; x < signals.length; x++) {
        if (hasExecutingSignal(signals[x])) {
          return x
        }
      }
      return signals.length - 1
    }

    var update = function (signalType, data, forceUpdate) {
      if (!forceUpdate && (disableDebugger || !data || !hasInitialPayload)) {
        return
      }

      var detail = {
        type: signalType,
        app: APP_ID,
        version: VERSION,
        data: data
      }

      var event = new CustomEvent('cerebral.dev.update', {
        detail: JSON.stringify(detail)
      })
      window.dispatchEvent(event)
    }

    var getInit = function () {
      var signals = signalStore.getSignals()
      nextSignalInLine = signals.length ? getOldestExecutingSignalIndex(signals, nextSignalInLine) : 0
      hasInitialPayload = true
      return {
        initialModel: controller.get(),
        signals: signals,
        willKeepState: willKeepState,
        disableDebugger: disableDebugger,
        isExecutingAsync: signalStore.isExecutingAsync()
      }
    }

    var updateSignals = function () {
      if (isAwaitingFrame) {
        return
      }

      isAwaitingFrame = true
      requestAnimationFrame(function () {
        var signals = signalStore.getSignals()

        // In case last executed signal is now done
        update('signals', {
          signals: signals.slice(nextSignalInLine),
          isExecutingAsync: signalStore.isExecutingAsync()
        })

        // Set new last executed signal
        nextSignalInLine = signals.length ? getOldestExecutingSignalIndex(signals, nextSignalInLine) : 0
        isAwaitingFrame = false
      })
    }

    var updateSettings = function () {
      update('settings', {
        willKeepState: willKeepState,
        disableDebugger: disableDebugger
      }, true)
    }

    window.addEventListener('cerebral.dev.debuggerPing', function () {
      var signals = []

      if (utils.hasLocalStorage()) {
        disableDebugger = JSON.parse(localStorage.getItem('cerebral_disable_debugger'))
        signals = JSON.parse(localStorage.getItem('cerebral_signals')) || []
        willKeepState = JSON.parse(localStorage.getItem('cerebral_willKeepState'))
      }

      // Might be an async signal running here
      if (willKeepState && signalStore.isExecutingAsync()) {
        controller.once('signalEnd', function () {
          signalStore.setSignals(signals)
          signalStore.remember(signalStore.getSignals().length - 1)
          isInitialized = true
          var event = new CustomEvent('cerebral.dev.cerebralPong', {
            detail: JSON.stringify({
              type: 'init',
              app: APP_ID,
              version: VERSION,
              data: getInit()
            })
          })
          window.dispatchEvent(event)
        })
      } else {
        signalStore.setSignals(signals)
        signalStore.rememberInitial(signalStore.getSignals().length - 1)
        isInitialized = true
        var event = new CustomEvent('cerebral.dev.cerebralPong', {
          detail: JSON.stringify({
            type: 'init',
            app: APP_ID,
            version: VERSION,
            data: getInit()
          })
        })
        window.dispatchEvent(event)
      }
    })

    window.addEventListener('cerebral.dev.toggleKeepState', function () {
      willKeepState = !willKeepState
      updateSettings()
    })

    window.addEventListener('cerebral.dev.toggleDisableDebugger', function () {
      disableDebugger = !disableDebugger
      if (disableDebugger && willKeepState) {
        willKeepState = !willKeepState
      }
      updateSettings()
    })

    window.addEventListener('cerebral.dev.resetStore', function () {
      signalStore.reset()
      controller.emit('change')
      update()
    })

    window.addEventListener('cerebral.dev.remember', function (event) {
      signalStore.remember(event.detail)
    })

    window.addEventListener('cerebral.dev.rewrite', function (event) {
      var signals = signalStore.getSignals()
      signals.splice(event.detail + 1, signals.length - 1 - event.detail)
      signalStore.remember(event.detail)
    })

    window.addEventListener('cerebral.dev.logPath', function (event) {
      var name = event.detail.name
      var value = controller.get(event.detail.path)
      // toValue instead?
      console.log('CEREBRAL - ' + name + ':', value.toJS ? value.toJS() : value)
    })

    window.addEventListener('cerebral.dev.logModel', function (event) {
      console.log('CEREBRAL - model:', controller.logModel())
    })

    window.addEventListener('cerebral.dev.changeModel', function (event) {
      module.getSignals().modelChanged(event.detail)
    })

    window.addEventListener('unload', function () {
      signalStore.removeRunningSignals()

      if (utils.hasLocalStorage()) {
        localStorage.setItem('cerebral_signals', isInitialized && willKeepState ? JSON.stringify(signalStore.getSignals()) : JSON.stringify([]))
        localStorage.setItem('cerebral_willKeepState', isInitialized && JSON.stringify(willKeepState))
        localStorage.setItem('cerebral_disable_debugger', isInitialized && JSON.stringify(disableDebugger))
      }
    })

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) {
        updateSettings()
      }
    })

    var services = {
      update: update,
      start: function () {
        console.warn('Cerebral: devtools.start() method is deprecated. Devtools has started automatically.')
      }
    }

    module.addServices(services)

    controller.getDevtools = function () {
      console.warn('Cerebral: controller.getDevtools() method is deprecated. Please upgrade your view package to latest version.')
      return services
    }

    function start () {
      if (window.__CEREBRAL_DEVTOOLS_GLOBAL_HOOK__) {
        window.__CEREBRAL_DEVTOOLS_GLOBAL_HOOK__.signals = controller.getSignals()
        window.__CEREBRAL_DEVTOOLS_GLOBAL_HOOK__.staticTree = staticTree
      }

      var event = new CustomEvent('cerebral.dev.cerebralPing')
      window.dispatchEvent(event)

      console.assert(controller.listeners('modulesLoaded')[0] === start, 'Cerebral devtools: Please do not place any listeners to `modulesLoaded` event before devtools\'s one.')
    }

    var listeners = controller.listeners('modulesLoaded')
    controller.removeAllListeners('modulesLoaded')

    controller.on('modulesLoaded', start)
    listeners.forEach(function (listener) {
      controller.on('modulesLoaded', listener)
    })

    controller.on('change', updateSignals)
  }
}
