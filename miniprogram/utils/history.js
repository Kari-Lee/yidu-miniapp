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

function getRecord(id) {
  return getRecords().filter(function(item) { return item.id === id })[0] || null
}

function getLatestByProfile(profileId) {
  if (!profileId) return null
  return getRecords().filter(function(item) {
    return item.profileId === profileId
  })[0] || null
}

function getRecordsByProfile(profileId) {
  if (!profileId) return []
  return getRecords().filter(function(item) {
    return item.profileId === profileId
  })
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

function removeRecord(id) {
  var list = getRecords().filter(function(item) { return item.id !== id })
  wx.setStorageSync(KEY, list)
}

function updateRecord(id, patch) {
  var updated = null
  var list = getRecords().map(function(item) {
    if (item.id !== id) return item
    updated = Object.assign({}, item, patch || {})
    return updated
  })
  if (updated) wx.setStorageSync(KEY, list)
  return updated
}

function setRecordFeedback(id, feedback) {
  var value = Object.assign({
    updatedAt: Date.now()
  }, feedback || {})
  return updateRecord(id, { feedback: value })
}

module.exports = {
  addRecord: addRecord,
  updateRecord: updateRecord,
  setRecordFeedback: setRecordFeedback,
  getRecords: getRecords,
  getRecord: getRecord,
  getRecordsByProfile: getRecordsByProfile,
  getLatestByProfile: getLatestByProfile,
  clearRecords: clearRecords,
  removeRecord: removeRecord
}
