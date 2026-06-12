var D = require('../../utils/data')
var API = require('../../utils/api')
var H = require('../../utils/history')
var N = require('../../utils/normalize')
var Share = require('../../utils/share')
var Format = require('../../utils/format')
var ChatImages = require('../../utils/chatImages')
var MSGS = ["评估杀伤力", "模拟Ta反应"]
var REPLY_MSGS = ["拆解当前局面", "压低情绪浓度", "生成可发版本"]

function safeDecode(v) {
  try { return decodeURIComponent(v) } catch(e) { return v || '' }
}

function makeContextTip(name, count) {
  var n = parseInt(count || 0, 10) || 0
  return '已带入' + (name || '这段关系') + '的档案' + (n ? '和' + n + '条历史摘要' : '')
}

function hasInput(text, imgs, isReplyMode, replyTask) {
  return !!((text || '').trim() || (imgs && imgs.length) || (isReplyMode && replyTask))
}

Page({
  data: {
    statusBarHeight: 0, step: 'input', mode: 'check', text: '', imgs: [], pType: '', ctx: '', replyTask: '', err: null,
    initialPType: '', profileId: '', profileName: '', profileHistoryCount: 0, contextTip: '',
    ctxEnabled: false, initialCtxEnabled: false, ctxPreviewOpen: false,
    isReplyMode: false,
    hasInput: false, submitting: false, loadingMsg: '', res: null,
    typeOptions: [
      { key:'avoidant', emoji:'🧊', label:'回避型', color:'#0984E3', bg:'rgba(9,132,227,0.08)' },
      { key:'anxious', emoji:'🔥', label:'焦虑型', color:'#E17055', bg:'rgba(225,112,85,0.08)' },
      { key:'secure', emoji:'🌿', label:'安全型', color:'#00B894', bg:'rgba(0,184,148,0.08)' },
      { key:'disorganized', emoji:'🌀', label:'混乱型', color:'#6C5CE7', bg:'rgba(108,92,231,0.08)' },
    ]
  },
  _timer: null,
  onLoad: function(options) {
    var profileId = options && options.profileId ? safeDecode(options.profileId) : ''
    var profileName = options && options.profileName ? safeDecode(options.profileName) : ''
    var historyCount = parseInt(options && options.profileHistoryCount || 0, 10) || 0
    var ctx = options && options.ctx ? safeDecode(options.ctx) : ''
    var pType = options && options.pType ? options.pType : ''
    var mode = options && options.mode === 'reply' ? 'reply' : 'check'
    var replyTask = options && options.replyTask ? safeDecode(options.replyTask) : ''
    var hasCtxEnabledOption = options && options.ctxEnabled !== undefined
    var ctxEnabled = hasCtxEnabledOption ? options.ctxEnabled === '1' : !!ctx
    this.setData({
      statusBarHeight: getApp().globalData.statusBarHeight,
      mode: mode,
      isReplyMode: mode === 'reply',
      pType: pType,
      initialPType: pType,
      ctx: ctx,
      replyTask: replyTask,
      ctxEnabled: ctxEnabled,
      initialCtxEnabled: ctxEnabled,
      profileId: profileId,
      profileName: profileName,
      profileHistoryCount: historyCount,
      contextTip: profileId && ctx ? makeContextTip(profileName, historyCount) : '',
      hasInput: mode === 'reply' && !!replyTask
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
    this.setData({
      text: e.detail.value,
      hasInput: hasInput(e.detail.value, this.data.imgs, this.data.isReplyMode, this.data.replyTask)
    })
  },
  chooseImg: function() {
    var self = this
    var remaining = ChatImages.MAX_IMAGES - self.data.imgs.length
    if (remaining <= 0) {
      wx.showToast({ title: '这组截图已经够完整了', icon: 'none' })
      return
    }
    wx.chooseImage({
      count: Math.min(9, remaining),
      sizeType: ['compressed'],
      success: function(r) {
        var paths = self.data.imgs.map(function(item) {
          return item.originalPath || item.path
        }).concat(r.tempFilePaths)
        wx.showLoading({ title: '优化截图中' })
        ChatImages.optimizeImages(paths).then(function(imgs) {
          wx.hideLoading()
          self.setData({
            imgs: imgs,
            hasInput: hasInput(self.data.text, imgs, self.data.isReplyMode, self.data.replyTask)
          })
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
    wx.previewImage({ current: urls[idx], urls: urls })
  },
  removeImg: function(e) {
    var idx = e.currentTarget.dataset.index
    var imgs = this.data.imgs.slice()
    imgs.splice(idx, 1)
    this.setData({
      imgs: imgs,
      hasInput: hasInput(this.data.text, imgs, this.data.isReplyMode, this.data.replyTask)
    })
  },
  clearImgs: function() {
    this.setData({
      imgs: [],
      hasInput: hasInput(this.data.text, [], this.data.isReplyMode, this.data.replyTask)
    })
  },
  pickType: function(e) { this.setData({ pType: e.currentTarget.dataset.key }) },
  toggleCtxEnabled: function(e) { this.setData({ ctxEnabled: e.detail.value }) },
  toggleCtxPreview: function() { this.setData({ ctxPreviewOpen: !this.data.ctxPreviewOpen }) },
  resetInput: function() {
    this._submitting = false
    this.setData({
      step: 'input',
      text: '',
      imgs: [],
      pType: this.data.initialPType,
      ctxEnabled: this.data.initialCtxEnabled,
      ctxPreviewOpen: false,
      err: null,
      res: null,
      submitting: false,
      hasInput: hasInput('', [], this.data.isReplyMode, this.data.replyTask)
    })
  },

  submit: function() {
    if (this._submitting) return
    if (!hasInput(this.data.text, this.data.imgs, this.data.isReplyMode, this.data.replyTask)) return
    var self = this
    self._submitting = true
    self.stopLoading()
    var msgs = self.data.isReplyMode ? REPLY_MSGS : MSGS
    self.setData({ step: 'loading', err: null, submitting: true, loadingMsg: msgs[0] })
    var n = 0
    self._timer = setInterval(function() { n++; self.setData({ loadingMsg: msgs[n % msgs.length] }) }, 1200)

    var typeLabel = self.data.pType ? (D.TI[self.data.pType] || {}).label || '未知' : '未知'
    var ctx = (!self.data.contextTip || self.data.ctxEnabled) ? self.data.ctx : ''
    var prompt = self.data.isReplyMode ? D.P.reply : D.P.check
    var um = ''
    if (self.data.isReplyMode) {
      um = (ctx ? '关系背景：' + ctx + '\n\n' : '') +
        (self.data.replyTask ? '来源分析：\n' + self.data.replyTask + '\n\n' : '') +
        '对方类型：' + typeLabel + '\n\n' +
        (self.data.text.trim() ? '用户想表达：' + self.data.text : '用户需求：请根据当前局面，写下一句适合发给Ta的话。')
    } else {
      um = (ctx ? '关系背景：' + ctx + '\n\n' : '') +
        '对方类型：' + typeLabel + '\n\n' +
        (self.data.text.trim()
          ? '我想发：' + self.data.text
          : '请结合聊天截图中的上下文，判断我接下来准备发送或最新输入的消息是否合适。') +
        (self.data.imgs.length ? '\n\n请同时参考所附聊天截图。' : '')
    }

    var requestOptions = {
      onRetry: function() { self.setData({ loadingMsg: '连接波动，正在自动重试' }) },
      onStatus: function(message) { self.setData({ loadingMsg: message }) },
      onPrepared: function(imgs) { self.setData({ imgs: imgs }) }
    }
    var request = self.data.isReplyMode
      ? API.callAI(prompt, um, null, null, requestOptions)
      : ChatImages.callAI(prompt, um, self.data.imgs, requestOptions)

    request.then(function(res) {
      self.stopLoading()
      self._submitting = false
      res = self.data.isReplyMode ? N.normalizeReply(res) : N.normalizeCheck(res)
      H.addRecord({
        kind: self.data.isReplyMode ? 'reply' : 'check',
        kindLabel: self.data.isReplyMode ? '回复建议' : '发不发',
        title: self.data.isReplyMode ? '下一句怎么回' : (res.verdict || '消息检测'),
        summary: self.data.isReplyMode ? (res.strategy || '已生成可发送回复') : (res.reason || res.prediction || '已生成发送建议'),
        input: self.data.text.slice(0, 80) || (self.data.isReplyMode ? '基于分析结果生成回复' : ''),
        imageCount: self.data.imgs.length,
        profileId: self.data.profileId,
        profileName: self.data.profileName,
        result: res
      })
      self.setData({ step: 'result', res: res, submitting: false })
    }).catch(function(e) {
      self.stopLoading()
      self._submitting = false
      self.setData({ step: 'input', err: e.message || '出错了', submitting: false })
    })
  },

  onShareAppMessage: function() {
    return Share.check(this.data.isReplyMode ? '下一句怎么回' : (this.data.res && this.data.res.verdict))
  },

  copyResult: function() {
    if (!this.data.res) return
    wx.setClipboardData({ data: this.data.isReplyMode ? Format.reply(this.data.res) : Format.check(this.data.res) })
  }
})
