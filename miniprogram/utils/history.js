var KEY = 'yidu_history_records'
var LIMIT = 50

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function formatTime(ts) {
  var d = new Date(ts)
  return (d.getMonth() + 1) + '-' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

function getRecords() {
  try {
    return wx.getStorageSync(KEY) || []
  } catch(e) {
    return []
  }
}

function addRecord(record) {
  var ts = Date.now()
  var item = Object.assign({
    id: String(ts),
    createdAt: ts,
    timeText: formatTime(ts)
  }, record)
  var list = [item].concat(getRecords()).slice(0, LIMIT)
  wx.setStorageSync(KEY, list)
  return item
}

function clearRecords() {
  wx.removeStorageSync(KEY)
}

module.exports = {
  addRecord: addRecord,
  getRecords: getRecords,
  clearRecords: clearRecords
}
