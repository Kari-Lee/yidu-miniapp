var KEY = 'yidu_relation_profiles'
var LIMIT = 20

function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

function formatTime(ts) {
  var d = new Date(ts)
  return (d.getMonth() + 1) + '-' + d.getDate() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

function getProfiles() {
  try {
    return wx.getStorageSync(KEY) || []
  } catch(e) {
    return []
  }
}

function saveProfiles(list) {
  wx.setStorageSync(KEY, list.slice(0, LIMIT))
}

function addProfile(profile) {
  var ts = Date.now()
  var item = {
    id: String(ts),
    name: profile.name,
    relation: profile.relation || '暧昧对象',
    type: profile.type || '',
    typeLabel: profile.typeLabel || '未知',
    note: profile.note || '',
    createdAt: ts,
    updatedAt: ts,
    timeText: formatTime(ts)
  }
  saveProfiles([item].concat(getProfiles()))
  return item
}

function updateProfile(id, patch) {
  var ts = Date.now()
  var updated = null
  var list = getProfiles().map(function(item) {
    if (item.id !== id) return item
    updated = Object.assign({}, item, patch, {
      id: item.id,
      createdAt: item.createdAt,
      updatedAt: ts,
      timeText: formatTime(ts)
    })
    return updated
  })
  saveProfiles(list)
  return updated
}

function removeProfile(id) {
  saveProfiles(getProfiles().filter(function(item) { return item.id !== id }))
}

function touchProfile(id) {
  var ts = Date.now()
  var list = getProfiles().map(function(item) {
    if (item.id !== id) return item
    return Object.assign({}, item, { updatedAt: ts, timeText: formatTime(ts) })
  })
  saveProfiles(list)
}

module.exports = {
  getProfiles: getProfiles,
  addProfile: addProfile,
  updateProfile: updateProfile,
  removeProfile: removeProfile,
  touchProfile: touchProfile
}
