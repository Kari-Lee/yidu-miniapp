var app = getApp()
var REQUEST_TIMEOUT = 70000
var RETRY_DELAY = 800
var pendingRequests = {}

function getErrorMessage(r) {
  var data = r.data || {}
  if (data.error) return data.error
  if (r.statusCode === 413) return '截图优化没有完成，请直接再试一次'
  if (r.statusCode === 429) return '分析太频繁了，稍等一下再试'
  if (r.statusCode === 504) return '这次分析超时了，内容已保留，请直接重试'
  if (r.statusCode >= 500) return 'AI服务暂时不稳定，等会再试'
  return '服务暂时不可用'
}

function parseResponse(data) {
  var raw = ''
  if (typeof data === 'string') {
    raw = data
  } else if (data && data.text) {
    raw = data.text
  } else {
    return data
  }
  raw = raw.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  if (raw.indexOf('<think>') !== -1) raw = raw.substring(0, raw.indexOf('<think>')).trim()
  raw = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  try { return JSON.parse(raw) } catch(e) {}
  var first = raw.indexOf('{'), last = raw.lastIndexOf('}')
  if (first !== -1 && last > first) {
    try { return JSON.parse(raw.substring(first, last + 1)) } catch(e) {}
  }
  if (raw.length > 10) return { text: raw, fallback: true }
  throw new Error('AI返回格式异常')
}

function requestOnce(body) {
  return new Promise(function(resolve, reject) {
    wx.request({
      url: app.globalData.apiBaseUrl + '/chat',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: body,
      timeout: REQUEST_TIMEOUT,
      success: function(r) {
        if (r.statusCode === 200 && r.data) {
          try {
            resolve(parseResponse(r.data))
          } catch(e) {
            reject(e.message ? e : new Error('解析失败，请重试'))
          }
        } else {
          var err = new Error(getErrorMessage(r))
          err.statusCode = r.statusCode
          err.retryable = r.statusCode === 502 || r.statusCode === 503
          reject(err)
        }
      },
      fail: function(e) {
        var timedOut = e && e.errMsg && e.errMsg.indexOf('timeout') !== -1
        var msg = timedOut
          ? '这次分析超时了，内容已保留，请直接重试'
          : '网络连接失败'
        var err = new Error(msg)
        err.retryable = !timedOut
        reject(err)
      }
    })
  })
}

function wait(ms) {
  return new Promise(function(resolve) { setTimeout(resolve, ms) })
}

function makeRequestKey(body) {
  var parts = [
    body.system || '',
    body.message || '',
    (body.imageKeys || []).join('|')
  ]
  ;(body.images || []).forEach(function(image) {
    parts.push(image.length + ':' + image.slice(0, 64) + ':' + image.slice(-64))
  })
  var value = parts.join('\n')
  var hash = 5381
  for (var i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i)
  }
  return String(hash >>> 0)
}

function callAI(sys, message, images, imageKeys, options) {
  var body = { system: sys, message: message }
  if (images && images.length > 0) body.images = images
  if (imageKeys && imageKeys.length > 0) body.imageKeys = imageKeys
  var key = makeRequestKey(body)
  if (pendingRequests[key]) return pendingRequests[key]

  options = options || {}
  var promise = requestOnce(body).catch(function(err) {
    if (!err.retryable) throw err
    if (options.onRetry) options.onRetry()
    return wait(RETRY_DELAY).then(function() { return requestOnce(body) })
  })
  pendingRequests[key] = promise
  promise.then(function() {
    delete pendingRequests[key]
  }, function() {
    delete pendingRequests[key]
  })
  return promise
}

module.exports = { callAI: callAI }
