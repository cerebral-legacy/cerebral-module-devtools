module.exports = function (context, execution) {
  var originalOutput = context.output
  var outputPaths = Object.keys(context.output)
  var output = function () {
    var path = typeof arguments[0] === 'string' ? arguments[0] : null
    var payload = path ? arguments[1] : arguments[0]
    execution.action.output = payload
    originalOutput.apply(null, arguments)
  }

  outputPaths.reduce(function (output, key) {
    output[key] = function () {
      execution.action.output = arguments[0] || {}
      originalOutput[key].apply(null, arguments)
    }
    return output
  }, output)

  context.output = output

  return context
}
