// 轻量埋点：复制/分享即上报，收集被用户验证过的「金句」。
// fire-and-forget：失败静默，绝不影响交互。
// 需要后端实现 POST {apiBaseUrl}/feedback 接收并存储下列字段。

var app = getApp()

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
    source: info.source || '',
    weapon: info.weapon || '',
    text: info.text || '',
    ts: Date.now()
  })
}

function reportShare(info) {
  info = info || {}
  post({
    event: 'share',
    task: 'misread',
    mode: info.mode || '',
    source: info.source || '',
    ts: Date.now()
  })
}

module.exports = { reportCopy: reportCopy, reportShare: reportShare }
