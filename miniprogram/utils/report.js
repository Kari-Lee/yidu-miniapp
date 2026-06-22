// 轻量埋点：展示/复制/评分即上报，收集被用户验证过的「金句」。
// fire-and-forget：失败静默，绝不影响交互。

var app = getApp()

function redact(value, maxLength) {
  return String(value || '')
    .replace(/https?:\/\/[!-~]+/gi, function(match) {
      var trailing = match.match(/[,.!?]+$/)
      return '[链接]' + (trailing ? trailing[0] : '')
    })
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[邮箱]')
    .replace(/(?:\+?86[-\s]?)?1[3-9]\d{9}/g, '[手机号]')
    .replace(/\b\d{15,19}\b/g, '[长号码]')
    .replace(/(?:微信|wx|wechat|QQ|扣扣)(?:号|号码|ID|id)?\s*[:：]?\s*[A-Za-z0-9_-]{5,}/gi, '[账号]')
    .replace(/@[^\s，。！？,.!?]{2,24}/g, '[用户]')
    .slice(0, maxLength)
}

function post(payload) {
  if (!app || !app.globalData || !app.globalData.apiBaseUrl) return
  try {
    wx.request({
      url: app.globalData.apiBaseUrl + '/feedback',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: payload,
      timeout: 8000,
      fail: function() {},
      success: function() {}
    })
  } catch (e) {}
}

function replyPayload(event, info) {
  info = info || {}
  return {
    event: event,
    task: 'misread',
    mode: info.mode || '',
    route: info.route || '',
    batchId: info.batchId || '',
    replyId: info.replyId || '',
    replyIndex: typeof info.replyIndex === 'number' ? info.replyIndex : null,
    promptVersion: info.promptVersion || '',
    weapon: info.weapon || '',
    source: redact(info.source, 1200),
    text: redact(info.text, 500),
    ts: Date.now()
  }
}

function reportServeBatch(info) {
  info = info || {}
  var replies = info.replies || []
  replies.forEach(function(item, index) {
    item = item || {}
    post(replyPayload('serve', {
      mode: info.mode,
      route: info.route,
      batchId: info.batchId,
      replyId: info.batchId + '_' + index,
      replyIndex: index,
      promptVersion: info.promptVersion,
      weapon: item.type,
      source: info.source,
      text: item.text
    }))
  })
}

function reportCopy(info) {
  post(replyPayload('copy', info))
}

function reportRating(info) {
  info = info || {}
  var payload = replyPayload('rating', info)
  payload.verdict = info.verdict || ''
  payload.reason = info.reason || ''
  post(payload)
}

function reportRefresh(info) {
  info = info || {}
  post({
    event: 'refresh',
    task: 'misread',
    mode: info.mode || '',
    route: info.route || '',
    batchId: info.batchId || '',
    promptVersion: info.promptVersion || '',
    source: redact(info.source, 1200),
    ts: Date.now()
  })
}

function reportShare(info) {
  info = info || {}
  post({
    event: 'share',
    task: 'misread',
    mode: info.mode || '',
    batchId: info.batchId || '',
    promptVersion: info.promptVersion || '',
    source: redact(info.source, 1200),
    ts: Date.now()
  })
}

module.exports = {
  reportServeBatch: reportServeBatch,
  reportCopy: reportCopy,
  reportRating: reportRating,
  reportRefresh: reportRefresh,
  reportShare: reportShare
}
