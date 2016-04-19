module.exports = function (context, execution) {
  execution.action.input = execution.payload
  return context
}
