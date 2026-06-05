var Profiles = require('./profiles')
var H = require('./history')

var MAX_RECORDS = 3
var MAX_NOTE = 120
var MAX_TITLE = 48
var MAX_SUMMARY = 96

function truncate(text, max) {
  text = (text || '').replace(/\s+/g, ' ').trim()
  if (!text || text.length <= max) return text
  return text.slice(0, max) + '...'
}

function findProfile(id) {
  if (!id) return null
  return Profiles.getProfiles().filter(function(item) {
    return item.id === id
  })[0] || null
}

function recordLine(record, index) {
  return (index + 1) + '. ' + [
    record.kindLabel || '分析',
    record.timeText || '',
    truncate(record.title, MAX_TITLE),
    truncate(record.summary, MAX_SUMMARY)
  ].filter(Boolean).join('｜')
}

function build(profile, options) {
  if (!profile) return { text: '', historyCount: 0 }
  options = options || {}
  var maxRecords = options.maxRecords || MAX_RECORDS
  var records = H.getRecordsByProfile(profile.id).slice(0, maxRecords)
  var lines = [
    '关系档案：' + profile.name,
    '关系：' + (profile.relation || '未知'),
    'Ta的疑似依恋类型：' + (profile.typeLabel || '未知'),
    profile.note ? '备注：' + truncate(profile.note, MAX_NOTE) : ''
  ].filter(Boolean)

  if (records.length) {
    lines.push('这个人的最近分析摘要：')
    records.forEach(function(record, index) {
      lines.push(recordLine(record, index))
    })
  }

  return {
    text: lines.join('\n'),
    historyCount: records.length
  }
}

function query(profile, options) {
  var ctx = build(profile, options)
  return [
    'profileId=' + encodeURIComponent(profile.id),
    'profileName=' + encodeURIComponent(profile.name),
    'profileHistoryCount=' + encodeURIComponent(ctx.historyCount),
    'ctx=' + encodeURIComponent(ctx.text)
  ].join('&')
}

function queryById(id, fallbackName) {
  var profile = findProfile(id)
  if (profile) return query(profile)
  return [
    'profileId=' + encodeURIComponent(id || ''),
    'profileName=' + encodeURIComponent(fallbackName || ''),
    'profileHistoryCount=0'
  ].join('&')
}

module.exports = {
  build: build,
  query: query,
  queryById: queryById,
  findProfile: findProfile
}
