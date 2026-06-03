var app = getApp()
var REQUEST_TIMEOUT = 60000

function getErrorMessage(r) {
  var data = r.data || {}
  if (data.error) return data.error
  if (r.statusCode === 413) return '截图太大了，少传几张或裁剪后再试'
  if (r.statusCode === 429) return '分析太频繁了，稍等一下再试'
  if (r.statusCode >= 500) return 'AI服务暂时不稳定，等会再试'
  return '服务暂时不可用'
}

function callAI(sys, message, images) {
  return new Promise(function(resolve, reject) {
    var body = { system: sys, message: message }
    if (images && images.length > 0) body.images = images

    wx.request({
      url: app.globalData.apiBaseUrl + '/chat',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: body,
      timeout: REQUEST_TIMEOUT,
      success: function(r) {
        if (r.statusCode === 200 && r.data) {
          try {
            var raw = ''
            if (typeof r.data === 'string') {
              raw = r.data
            } else if (r.data.text) {
              raw = r.data.text
            } else {
              resolve(r.data)
              return
            }
            // 清理思考标签
            raw = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
            if (raw.indexOf('<think>') !== -1) raw = raw.substring(0, raw.indexOf('<think>')).trim()
            raw = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
            // 尝试解析JSON
            try { resolve(JSON.parse(raw)); return } catch(e) {}
            var first = raw.indexOf('{'), last = raw.lastIndexOf('}')
            if (first !== -1 && last > first) {
              try { resolve(JSON.parse(raw.substring(first, last + 1))); return } catch(e) {}
            }
            if (raw.length > 10) { resolve({ text: raw, fallback: true }); return }
            reject(new Error('AI返回格式异常'))
          } catch(e) {
            reject(new Error('解析失败，请重试'))
          }
        } else {
          reject(new Error(getErrorMessage(r)))
        }
      },
      fail: function(e) {
        var msg = e && e.errMsg && e.errMsg.indexOf('timeout') !== -1
          ? '分析超时了，少传一点内容再试'
          : '网络连接失败'
        reject(new Error(msg))
      }
    })
  })
}

module.exports = { callAI: callAI }
