var D = require('../../utils/data')
var API = require('../../utils/api')
var H = require('../../utils/history')
var N = require('../../utils/normalize')
var Share = require('../../utils/share')
var Format = require('../../utils/format')
var MSGS = ["扫描关系轨迹", "模拟未来走向"]

function safeDecode(v) {
  try { return decodeURIComponent(v) } catch(e) { return v || '' }
}

function makeContextTip(name, count) {
  var n = parseInt(count || 0, 10) || 0
  return '已带入' + (name || '这段关系') + '的档案' + (n ? '和' + n + '条历史摘要' : '')
}

Page({
  data: {
    statusBarHeight: 0, step: 'input', text: '', ctx: '', err: null,
    initialCtx: '', profileId: '', profileName: '', profileHistoryCount: 0, contextTip: '',
    ctxEnabled: false, initialCtxEnabled: false, ctxPreviewOpen: false,
    hasInput: false, loadingMsg: '', res: null,
    predBgs: ['#FFF5F3', '#FFF9E6', '#F0FFF4']
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
  onInput: function(e) { this.setData({ text: e.detail.value, hasInput: !!e.detail.value.trim() }) },
  onCtxInput: function(e) { this.setData({ ctx: e.detail.value }) },
  toggleCtxEnabled: function(e) { this.setData({ ctxEnabled: e.detail.value }) },
  toggleCtxPreview: function() { this.setData({ ctxPreviewOpen: !this.data.ctxPreviewOpen }) },
  nextStep: function() { if (this.data.hasInput) this.setData({ step: 'context' }) },
  backToInput: function() { this.setData({ step: 'input' }) },
  resetInput: function() {
    this.setData({
      step: 'input',
      text: '',
      ctx: this.data.initialCtx,
      ctxEnabled: this.data.initialCtxEnabled,
      ctxPreviewOpen: false,
      err: null,
      res: null,
      hasInput: false
    })
  },

  submit: function() {
    var self = this
    self.stopLoading()
    self.setData({ step: 'loading', err: null, loadingMsg: MSGS[0] })
    var n = 0
    self._timer = setInterval(function() { n++; self.setData({ loadingMsg: MSGS[n % MSGS.length] }) }, 1200)

    var ctx = (!self.data.contextTip || self.data.ctxEnabled) ? self.data.ctx : ''
    var um = (ctx ? '关系背景：' + ctx + '\n\n' : '') +
      (self.data.text.trim() ? '聊天记录：\n' + self.data.text : '')

    API.callAI(D.P.predict, um, null).then(function(res) {
      self.stopLoading()
      res = N.normalizePredict(res)
      H.addRecord({
        kind: 'predict',
        kindLabel: '感情预测',
        title: res.stage || '感情预测',
        summary: res.stage_desc || res.todo || '已生成关系走向预测',
        input: self.data.text.slice(0, 80),
        profileId: self.data.profileId,
        profileName: self.data.profileName,
        result: res
      })
      self.setData({ step: 'result', res: res })
    }).catch(function(e) {
      self.stopLoading()
      self.setData({ step: 'input', err: e.message || '出错了' })
    })
  },

  onShareAppMessage: function() {
    return Share.predict(this.data.res && this.data.res.stage)
  },

  copyResult: function() {
    if (!this.data.res) return
    wx.setClipboardData({ data: Format.predict(this.data.res) })
  }
})
