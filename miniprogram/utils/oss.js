var app = getApp()
var POLICY_TIMEOUT = 10000
var UPLOAD_TIMEOUT = 30000
var CONCURRENCY = 3

function requestPolicy() {
  return new Promise(function(resolve, reject) {
    wx.request({
      url: app.globalData.apiBaseUrl + '/oss-policy',
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      data: {},
      timeout: POLICY_TIMEOUT,
      success: function(r) {
        if (r.statusCode === 200 && r.data && r.data.host && r.data.policy) {
          resolve(r.data)
          return
        }
        var err = new Error((r.data && r.data.error) || '图片直传暂不可用')
        err.code = r.statusCode === 503 ? 'OSS_UNAVAILABLE' : 'OSS_POLICY_FAILED'
        reject(err)
      },
      fail: function() {
        var err = new Error('图片直传网络失败')
        err.code = 'OSS_NETWORK_FAILED'
        reject(err)
      }
    })
  })
}

function uploadOne(item, policy, index) {
  var key = policy.prefix + Date.now() + '-' + index + '-' + randomId() + '.jpg'
  return new Promise(function(resolve, reject) {
    wx.uploadFile({
      url: policy.host,
      filePath: item.path || item,
      name: 'file',
      timeout: UPLOAD_TIMEOUT,
      formData: {
        key: key,
        policy: policy.policy,
        OSSAccessKeyId: policy.accessKeyId,
        Signature: policy.signature,
        success_action_status: '200'
      },
      success: function(r) {
        if (r.statusCode >= 200 && r.statusCode < 300) {
          resolve(key)
          return
        }
        var err = new Error('第' + (index + 1) + '张截图上传失败')
        err.code = 'OSS_UPLOAD_FAILED'
        reject(err)
      },
      fail: function() {
        var err = new Error('第' + (index + 1) + '张截图上传失败')
        err.code = 'OSS_UPLOAD_FAILED'
        reject(err)
      }
    })
  })
}

function uploadWithLimit(items, policy, onProgress) {
  var results = new Array(items.length)
  var nextIndex = 0
  var completed = 0

  function worker() {
    var index = nextIndex++
    if (index >= items.length) return Promise.resolve()
    return uploadOne(items[index], policy, index).then(function(key) {
      results[index] = key
      completed++
      if (onProgress) onProgress(completed, items.length)
      return worker()
    })
  }

  var workers = []
  var count = Math.min(CONCURRENCY, items.length)
  for (var i = 0; i < count; i++) workers.push(worker())
  return Promise.all(workers).then(function() { return results })
}

function uploadImages(items, onProgress) {
  if (!items || !items.length) return Promise.resolve([])
  return requestPolicy().then(function(policy) {
    return uploadWithLimit(items, policy, onProgress)
  })
}

function randomId() {
  return Math.random().toString(36).slice(2, 10)
}

module.exports = { uploadImages: uploadImages }
