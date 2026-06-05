var D = require('../../utils/data')
var API = require('../../utils/api')
var H = require('../../utils/history')
var N = require('../../utils/normalize')
var Share = require('../../utils/share')
var Format = require('../../utils/format')

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
var COMPRESS_QUALITY = 65
var MAX_TOTAL_BYTES = 7 * 1024 * 1024

function safeDecode(v) {
  try { return decodeURIComponent(v) } catch(e) { return v || '' }
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

function compressImage(path) {
  return new Promise(function(resolve) {
    wx.compressImage({
      src: path,
      quality: COMPRESS_QUALITY,
      success: function(r) { resolve(r.tempFilePath || path) },
      fail: function() { resolve(path) }
    })
  })
}

function prepareImage(path) {
  return compressImage(path).then(function(compressedPath) {
    return getFileInfo(compressedPath).then(function(info) {
      return {
        path: compressedPath,
        originalPath: path,
        size: info.size,
        sizeText: info.sizeText
      }
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
  return Promise.all(paths.map(function(item) {
    return readImageAsBase64(item.path || item)
  }))
}

function hasInput(text, imgs) {
  return !!((text || '').trim() || (imgs && imgs.length))
}

Page({
  data: {
    statusBarHeight: 0, step: 'input', text: '', ctx: '', imgs: [], err: null,
    profileId: '', profileName: '',
    hasInput: false, loadingMsg: '', res: null,
    userTI: null, partnerTI: null, userGrad: '', partnerGrad: '', userBg: '', partnerBg: ''
  },
  _timer: null,

  onLoad: function(options) {
    this.setData({
      statusBarHeight: getApp().globalData.statusBarHeight,
      ctx: options && options.ctx ? safeDecode(options.ctx) : '',
      profileId: options && options.profileId ? safeDecode(options.profileId) : '',
      profileName: options && options.profileName ? safeDecode(options.profileName) : ''
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
          var imgs = self.data.imgs.concat(items)
          self.setData({ imgs: imgs, hasInput: true })
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
    this.setData({ step: 'input', text: '', ctx: '', imgs: [], err: null, hasInput: false, res: null })
  },

  submit: function() {
    var self = this
    if (totalImageBytes(self.data.imgs) > MAX_TOTAL_BYTES) {
      self.setData({ err: '截图总大小超过7MB，请删除几张或裁剪后再试' })
      return
    }
    self.stopLoading()
    self.setData({ step: 'loading', err: null, loadingMsg: MSGS[0] })
    var n = 0
    self._timer = setInterval(function() { n++; self.setData({ loadingMsg: MSGS[n % MSGS.length] }) }, 1200)

    var um = (self.data.ctx ? '关系背景：' + self.data.ctx + '\n\n' : '') +
      (self.data.text.trim() ? '聊天记录：\n' + self.data.text : '请分析这些聊天记录截图')

    readImagesAsBase64(self.data.imgs).then(function(images) {
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
      })
    }).catch(function(e) {
      self.stopLoading()
      self.setData({ step: 'input', err: e.message || '出错了' })
    })
  },

  onShareAppMessage: function() {
    return Share.diagnose()
  },

  copyResult: function() {
    if (!this.data.res) return
    wx.setClipboardData({ data: Format.diagnose(this.data.res) })
  }
})
