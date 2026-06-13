var API = require('./api')
var OSS = require('./oss')

var MAX_IMAGES = 12
var MAX_TOTAL_BYTES = 2.7 * 1024 * 1024
var FALLBACK_TOTAL_BYTES = 1.55 * 1024 * 1024
var MAX_TOTAL_BASE64_CHARS = 3.7 * 1024 * 1024
var MAX_IMAGE_TARGET_BYTES = 1.1 * 1024 * 1024
var MIN_IMAGE_TARGET_BYTES = 190 * 1024
var FALLBACK_MAX_IMAGE_BYTES = 520 * 1024
var FALLBACK_MIN_IMAGE_BYTES = 105 * 1024
var COMPRESS_STEPS = [
  { quality: 62, width: 1600 },
  { quality: 50, width: 1400 },
  { quality: 40, width: 1200 },
  { quality: 32, width: 1000 },
  { quality: 26, width: 860 },
  { quality: 22, width: 760 },
  { quality: 18, width: 680 },
  { quality: 15, width: 600 }
]

function sizeText(bytes) {
  if (!bytes) return '未知大小'
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + 'MB'
  return Math.max(1, Math.round(bytes / 1024)) + 'KB'
}

function getFileInfo(path) {
  return new Promise(function(resolve) {
    wx.getFileInfo({
      filePath: path,
      success: function(r) {
        resolve({ size: r.size || 0, sizeText: sizeText(r.size || 0) })
      },
      fail: function() {
        resolve({ size: 0, sizeText: '未知大小' })
      }
    })
  })
}

function compressImage(path, quality, width) {
  return new Promise(function(resolve) {
    wx.compressImage({
      src: path,
      quality: quality,
      compressedWidth: width,
      success: function(r) { resolve(r.tempFilePath || path) },
      fail: function() { resolve(path) }
    })
  })
}

function makeImageItem(path, originalPath) {
  return getFileInfo(path).then(function(info) {
    return {
      path: path,
      originalPath: originalPath,
      size: info.size,
      sizeText: info.sizeText
    }
  })
}

function compressToTarget(path, targetBytes) {
  var best = null
  function run(index) {
    var step = COMPRESS_STEPS[index]
    return compressImage(path, step.quality, step.width).then(function(compressedPath) {
      return makeImageItem(compressedPath, path)
    }).then(function(item) {
      if (!best || (item.size && item.size < best.size)) best = item
      if ((item.size && item.size <= targetBytes) || index >= COMPRESS_STEPS.length - 1) {
        return best || item
      }
      return run(index + 1)
    })
  }
  return run(0)
}

function optimizeImages(paths, totalBudget, minTarget, maxTarget) {
  if (!paths.length) return Promise.resolve([])
  totalBudget = totalBudget || MAX_TOTAL_BYTES
  minTarget = minTarget || MIN_IMAGE_TARGET_BYTES
  maxTarget = maxTarget || MAX_IMAGE_TARGET_BYTES
  var targetBytes = Math.floor(totalBudget * 0.96 / paths.length)
  targetBytes = Math.max(minTarget, Math.min(maxTarget, targetBytes))
  return Promise.all(paths.map(function(path) {
    return compressToTarget(path, targetBytes)
  }))
}

function totalImageBytes(imgs) {
  return (imgs || []).reduce(function(sum, item) {
    return sum + (item.size || 0)
  }, 0)
}

function readImageAsBase64(path) {
  return new Promise(function(resolve, reject) {
    wx.getFileSystemManager().readFile({
      filePath: path,
      encoding: 'base64',
      success: function(r) { resolve(r.data) },
      fail: function() { reject(new Error('图片读取失败，请重新选择截图')) }
    })
  })
}

function totalBase64Chars(images) {
  return (images || []).reduce(function(sum, image) {
    return sum + (image ? image.length : 0)
  }, 0)
}

function mergeClientMeta(base, extra) {
  var result = {}
  Object.keys(base || {}).forEach(function(key) { result[key] = base[key] })
  Object.keys(extra || {}).forEach(function(key) { result[key] = extra[key] })
  return result
}

function callWithBase64Fallback(prompt, message, items, uploadError, options) {
  if (options.onStatus) options.onStatus('优化备用分析通道')
  var paths = items.map(function(item) { return item.path || item })
  return optimizeImages(
    paths,
    FALLBACK_TOTAL_BYTES,
    FALLBACK_MIN_IMAGE_BYTES,
    FALLBACK_MAX_IMAGE_BYTES
  ).then(function(fallbackItems) {
    if (options.onStatus) options.onStatus('识别聊天内容')
    return Promise.all(fallbackItems.map(function(item) {
      return readImageAsBase64(item.path || item)
    }))
  }).then(function(images) {
    if (totalBase64Chars(images) > MAX_TOTAL_BASE64_CHARS) {
      throw new Error('图片通道繁忙，请直接再试一次')
    }
    return API.callAI(prompt, message, images, null, {
      onRetry: options.onRetry,
      clientMeta: mergeClientMeta(options.clientMeta, {
        imageTransport: 'base64-fallback',
        uploadFallbackCode: uploadError && uploadError.code ? uploadError.code : 'UNKNOWN',
        uploadFallbackDetail: uploadError && uploadError.detail ? uploadError.detail : ''
      })
    })
  })
}

function callAI(prompt, message, imgs, options) {
  options = options || {}
  var prepare = totalImageBytes(imgs) > MAX_TOTAL_BYTES
    ? optimizeImages(imgs.map(function(item) { return item.originalPath || item.path }))
    : Promise.resolve(imgs || [])

  return prepare.then(function(items) {
    if (options.onPrepared) options.onPrepared(items)
    if (!items.length) {
      return API.callAI(prompt, message, null, null, {
        onRetry: options.onRetry,
        clientMeta: options.clientMeta
      })
    }
    return OSS.uploadImages(items, function(done, total) {
      if (options.onStatus) options.onStatus('上传截图 ' + done + '/' + total)
    }).then(function(imageKeys) {
      if (options.onStatus) options.onStatus('识别聊天内容')
      return API.callAI(prompt, message, null, imageKeys, {
        onRetry: options.onRetry,
        clientMeta: mergeClientMeta(options.clientMeta, { imageTransport: 'oss' })
      })
    }, function(err) {
      return callWithBase64Fallback(prompt, message, items, err, options)
    })
  })
}

module.exports = {
  MAX_IMAGES: MAX_IMAGES,
  optimizeImages: optimizeImages,
  callAI: callAI
}
