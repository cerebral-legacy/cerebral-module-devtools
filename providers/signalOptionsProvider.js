module.exports = function (context, execution) {
  execution.signal.isRecorded = execution.options.isRecorded
  execution.signal.isRouted = execution.options.isRouted
  return context
}
