// 轻量埋点：复制/分享即上报，收集被用户验证过的「金句」。
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

function reportCopy(info) {
  info = info || {}
  post({
    event: 'copy',
    task: 'misread',
    mode: info.mode || '',
    route: info.route || '',
    source: redact(info.source, 1200),
    weapon: info.weapon || '',
    text: redact(info.text, 500),
    ts: Date.now()
  })
}

function reportShare(info) {
  info = info || {}
  post({
    event: 'share',
    task: 'misread',
    mode: info.mode || '',
    source: redact(info.source, 1200),
    ts: Date.now()
  })
}

module.exports = { reportCopy: reportCopy, reportShare: reportShare }
