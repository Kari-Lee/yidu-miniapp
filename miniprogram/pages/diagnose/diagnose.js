var D = require('../../utils/data')
var API = require('../../utils/api')
var H = require('../../utils/history')
var N = require('../../utils/normalize')
var Share = require('../../utils/share')
var Format = require('../../utils/format')
var Profiles = require('../../utils/profiles')

var GRADS = {
  anxious: "linear-gradient(135deg,#E17055,#D63031,#C0392B)",
  avoidant: "linear-gradient(135deg,#74B9FF,#0984E3,#0652DD)",
  secure: "linear-gradient(135deg,#55EFC4,#00B894,#00896F)",
  disorganized: "linear-gradient(135deg,#A29BFE,#6C5CE7,#5542D6)"
}
var BGS = {
  anxious: "rgba(225,112,85,0.08)", avoidant: "rgba(9,132,227,0.08)",
  secure: "rgba(0,184,148,0.08)", disorganized: "rgba(108,92,231,0.08)"
}
var MSGS = ["扫描互动模式", "分析依恋信号", "生成双人报告"]
var MAX_IMAGES = 8
var COMPRESS_QUALITY = 52
var RETRY_COMPRESS_QUALITY = 32
var COMPRESS_WIDTH = 1440
var RETRY_COMPRESS_WIDTH = 1080
var MAX_IMAGE_BYTES = 1.4 * 1024 * 1024
var MAX_TOTAL_BYTES = 2.8 * 1024 * 1024
var MAX_TOTAL_BASE64_CHARS = 3.8 * 1024 * 1024

function safeDecode(v) {
  try { return decodeURIComponent(v) } catch(e) { return v || '' }
}

function makeContextTip(name, count) {
  var n = parseInt(count || 0, 10) || 0
  return '已带入' + (name || '这段关系') + '的档案' + (n ? '和' + n + '条历史摘要' : '')
}

function sizeText(bytes) {
  if (!bytes) return '未知大小'
  if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + 'MB'
  return Math.max(1, Math.round(bytes / 1024)) + 'KB'
}

function getFileInfo(path) {
  return new Promise(function(resolve) {
    wx.getFileInfo({
      filePath: path,
      success: function(r) { resolve({ size: r.size || 0, sizeText: sizeText(r.size || 0) }) },
      fail: function() { resolve({ size: 0, sizeText: '未知大小' }) }
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

function prepareImage(path) {
  return compressImage(path, COMPRESS_QUALITY, COMPRESS_WIDTH).then(function(compressedPath) {
    return makeImageItem(compressedPath, path)
  }).then(function(item) {
    if (!item.size || item.size <= MAX_IMAGE_BYTES) return item
    return compressImage(path, RETRY_COMPRESS_QUALITY, RETRY_COMPRESS_WIDTH).then(function(compressedPath) {
      return makeImageItem(compressedPath, path)
    })
  })
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

function readImagesAsBase64(paths) {
  if (!paths || paths.length === 0) return Promise.resolve(null)
  var results = []
  return paths.reduce(function(chain, item) {
    return chain.then(function() {
      return readImageAsBase64(item.path || item).then(function(base64) {
        results.push(base64)
      })
    })
  }, Promise.resolve()).then(function() { return results })
}

function totalBase64Chars(images) {
  return (images || []).reduce(function(sum, image) {
    return sum + (image ? image.length : 0)
  }, 0)
}

function fitImages(existing, incoming) {
  var kept = existing.slice()
  var bytes = totalImageBytes(kept)
  var skipped = 0
  incoming.forEach(function(item) {
    if ((item.size && item.size > MAX_IMAGE_BYTES) || bytes + (item.size || 0) > MAX_TOTAL_BYTES) {
      skipped++
      return
    }
    kept.push(item)
    bytes += item.size || 0
  })
  return { images: kept, skipped: skipped }
}

function hasInput(text, imgs) {
  return !!((text || '').trim() || (imgs && imgs.length))
}

Page({
  data: {
    statusBarHeight: 0, step: 'input', text: '', ctx: '', imgs: [], err: null,
    initialCtx: '', profileId: '', profileName: '', profileHistoryCount: 0, contextTip: '',
    ctxEnabled: false, initialCtxEnabled: false, ctxPreviewOpen: false,
    hasInput: false, loadingMsg: '', res: null,
    userTI: null, partnerTI: null, userGrad: '', partnerGrad: '', userBg: '', partnerBg: '',
    profileSynced: false
  },
  _timer: null,

  onLoad: function(options) {
    var profileId = options && options.profileId ? safeDecode(options.profileId) : ''
    var profileName = options && options.profileName ? safeDecode(options.profileName) : ''
    var historyCount = parseInt(options && options.profileHistoryCount || 0, 10) || 0
    var ctx = options && options.ctx ? safeDecode(options.ctx) : ''
    this.setData({
      statusBarHeight: getApp().globalData.statusBarHeight,
      ctx: ctx,
      initialCtx: ctx,
      ctxEnabled: !!ctx,
      initialCtxEnabled: !!ctx,
      profileId: profileId,
      profileName: profileName,
      profileHistoryCount: historyCount,
      contextTip: profileId && ctx ? makeContextTip(profileName, historyCount) : ''
    })
  },

  onUnload: function() { this.stopLoading() },

  goBack: function() { wx.navigateBack() },

  stopLoading: function() {
    if (!this._timer) return
    clearInterval(this._timer)
    this._timer = null
  },

  onInput: function(e) {
    this.setData({ text: e.detail.value, hasInput: hasInput(e.detail.value, this.data.imgs) })
  },

  onCtxInput: function(e) { this.setData({ ctx: e.detail.value }) },

  toggleCtxEnabled: function(e) {
    this.setData({ ctxEnabled: e.detail.value })
  },

  toggleCtxPreview: function() {
    this.setData({ ctxPreviewOpen: !this.data.ctxPreviewOpen })
  },

  chooseImg: function() {
    var self = this
    var remaining = MAX_IMAGES - self.data.imgs.length
    if (remaining <= 0) {
      wx.showToast({ title: '最多上传8张截图', icon: 'none' })
      return
    }
    wx.chooseImage({
      count: remaining, sizeType: ['compressed'],
      success: function(r) {
        wx.showLoading({ title: '压缩中' })
        Promise.all(r.tempFilePaths.map(prepareImage)).then(function(items) {
          wx.hideLoading()
          var fitted = fitImages(self.data.imgs, items)
          self.setData({ imgs: fitted.images, hasInput: hasInput(self.data.text, fitted.images) })
          if (fitted.skipped) {
            wx.showToast({ title: '部分截图过大，已自动跳过', icon: 'none' })
          }
        }).catch(function() {
          wx.hideLoading()
          wx.showToast({ title: '图片处理失败，请重选', icon: 'none' })
        })
      }
    })
  },

  previewImg: function(e) {
    var idx = e.currentTarget.dataset.index
    var urls = this.data.imgs.map(function(item) { return item.path })
    wx.previewImage({
      current: urls[idx],
      urls: urls
    })
  },

  removeImg: function(e) {
    var idx = e.currentTarget.dataset.index
    var imgs = this.data.imgs.slice()
    imgs.splice(idx, 1)
    this.setData({ imgs: imgs, hasInput: hasInput(this.data.text, imgs) })
  },

  clearImgs: function() {
    this.setData({ imgs: [], hasInput: hasInput(this.data.text, []) })
  },

  nextStep: function() {
    if (!this.data.hasInput) return
    this.setData({ step: 'context' })
  },

  backToInput: function() { this.setData({ step: 'input' }) },

  resetInput: function() {
    this.setData({
      step: 'input',
      text: '',
      ctx: this.data.initialCtx,
      ctxEnabled: this.data.initialCtxEnabled,
      ctxPreviewOpen: false,
      imgs: [],
      err: null,
      hasInput: false,
      res: null,
      profileSynced: false
    })
  },

  submit: function() {
    var self = this
    if (totalImageBytes(self.data.imgs) > MAX_TOTAL_BYTES) {
      self.setData({ err: '截图总大小超过2.8MB，请删除几张或裁剪后再试' })
      return
    }
    self.stopLoading()
    self.setData({ step: 'loading', err: null, loadingMsg: MSGS[0] })
    var n = 0
    self._timer = setInterval(function() { n++; self.setData({ loadingMsg: MSGS[n % MSGS.length] }) }, 1200)

    var ctx = (!self.data.contextTip || self.data.ctxEnabled) ? self.data.ctx : ''
    var um = (ctx ? '关系背景：' + ctx + '\n\n' : '') +
      (self.data.text.trim() ? '聊天记录：\n' + self.data.text : '请分析这些聊天记录截图')

    readImagesAsBase64(self.data.imgs).then(function(images) {
      if (totalBase64Chars(images) > MAX_TOTAL_BASE64_CHARS) {
        throw new Error('截图编码后仍然太大，请删除一两张再试')
      }
      return API.callAI(D.P.diagnose, um, images)
    }).then(function(res) {
      self.stopLoading()
      res = N.normalizeDiagnose(res)
      var ut = D.TI[res.user_type] || D.TI.secure
      var pt = D.TI[res.partner_type] || D.TI.secure
      H.addRecord({
        kind: 'diagnose',
        kindLabel: '聊天确诊',
        title: '你：' + (res.user_label || ut.label) + ' / Ta：' + (res.partner_label || pt.label),
        summary: res.match || '已生成双方依恋分析',
        input: self.data.text.slice(0, 80),
        imageCount: self.data.imgs.length,
        profileId: self.data.profileId,
        profileName: self.data.profileName,
        result: res
      })
      self.setData({
        step: 'result', res: res,
        userTI: ut, partnerTI: pt,
        userGrad: GRADS[res.user_type] || GRADS.secure,
        partnerGrad: GRADS[res.partner_type] || GRADS.secure,
        userBg: BGS[res.user_type] || BGS.secure,
        partnerBg: BGS[res.partner_type] || BGS.secure,
        profileSynced: false
      })
    }).catch(function(e) {
      self.stopLoading()
      self.setData({ step: 'input', err: e.message || '出错了' })
    })
  },

  onShareAppMessage: function() {
    return Share.diagnose()
  },

  goReply: function() {
    var res = this.data.res
    if (!res) return
    var task = [
      '来源：聊天确诊',
      '你：' + (res.user_label || '未知') + '，Ta：' + (res.partner_label || '未知'),
      res.match ? '互动模式：' + res.match : '',
      res.partner_advice ? '应对Ta：' + res.partner_advice : ''
    ].filter(Boolean).join('\n')
    var query = [
      'mode=reply',
      'replyTask=' + encodeURIComponent(task),
      'pType=' + encodeURIComponent(res.partner_type || ''),
      'profileId=' + encodeURIComponent(this.data.profileId || ''),
      'profileName=' + encodeURIComponent(this.data.profileName || ''),
      'profileHistoryCount=' + encodeURIComponent(this.data.profileHistoryCount || 0),
      'ctxEnabled=' + (this.data.ctxEnabled ? '1' : '0'),
      'ctx=' + encodeURIComponent(this.data.ctx || '')
    ].join('&')
    wx.navigateTo({ url: '/pages/check/check?' + query })
  },

  copyResult: function() {
    if (!this.data.res) return
    wx.setClipboardData({ data: Format.diagnose(this.data.res) })
  },

  syncPartnerType: function() {
    var res = this.data.res
    if (!this.data.profileId || !res) return
    var ti = D.TI[res.partner_type]
    if (!ti) {
      wx.showToast({ title: '暂时无法识别类型', icon: 'none' })
      return
    }
    var updated = Profiles.updateProfile(this.data.profileId, {
      type: res.partner_type,
      typeLabel: res.partner_label || ti.label
    })
    if (!updated) {
      wx.showToast({ title: '档案不存在', icon: 'none' })
      return
    }
    this.setData({ profileSynced: true })
    wx.showToast({ title: '已更新档案', icon: 'success' })
  }
})
