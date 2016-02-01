/* eslint-env browser*/
var MODULE = 'cerebral-module-devtools'
var SignalStore = require('cerebral-module-signal-store')
var utils = require('./utils')

module.exports = function Devtools () {
  if (typeof window === 'undefined') { return function () {} }
  if (typeof window.chrome === 'undefined') { return function () {} }

  return function init (module, controller) {
    module.alias(MODULE)

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
    var lastExecutedSignalIndex = 0
    var APP_ID = String(Date.now())
    var VERSION = 'v2'

    var getExecutingSignals = function (signals) {
      var executingSignals = []
      for (var x = signals.length - 1; x >= 0; x--) {
        if (!signals[x].isExecuting) {
          break
        }
        executingSignals.unshift(signals[x])
      }
      return executingSignals
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
      var executingSignals = getExecutingSignals(signals)

      lastExecutedSignalIndex = signals.indexOf(executingSignals[0])
      hasInitialPayload = true
      return {
        initialModel: controller.get(),
        signals: signals,
        willKeepState: willKeepState,
        disableDebugger: disableDebugger,
        isExecutingAsync: signalStore.isExecutingAsync()
      }
    }

    var updateInit = function () {
      update('init', getInit())
    }

    var updateSignals = function (arg) {
      var signals = signalStore.getSignals()
      var executingSignals = getExecutingSignals(signals)

      // In case last executed signal is now done
      update('signals', {
        signals: signals.slice(lastExecutedSignalIndex),
        isExecutingAsync: signalStore.isExecutingAsync()
      })

      // Set new last executed signal
      lastExecutedSignalIndex = signals.indexOf(executingSignals[0])
    }

    var updateSettings = function () {
      update('settings', {
        willKeepState: willKeepState,
        disableDebugger: disableDebugger
      }, true)
    }

    var initialize = function () {
      if (isInitialized) {
        updateInit()
      }
      var signals = []

      if (utils.hasLocalStorage()) {
        disableDebugger = JSON.parse(localStorage.getItem('cerebral_disable_debugger'))
        signals = JSON.parse(localStorage.getItem('cerebral_signals')) || []
        willKeepState = JSON.parse(localStorage.getItem('cerebral_willKeepState'))
      }

      isInitialized = true

      // Might be an async signal running here
      if (willKeepState && signalStore.isExecutingAsync()) {
        controller.once('signalEnd', function () {
          signalStore.setSignals(signals)
          signalStore.remember(signalStore.getSignals().length - 1)
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
    }

    window.addEventListener('cerebral.dev.debuggerPing', function () {
      initialize()
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
