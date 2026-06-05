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

Page({
  data: {
    statusBarHeight: 0, step: 'input', text: '', ctx: '', err: null,
    profileId: '', profileName: '',
    hasInput: false, loadingMsg: '', res: null,
    predBgs: ['#FFF5F3', '#FFF9E6', '#F0FFF4']
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
  onInput: function(e) { this.setData({ text: e.detail.value, hasInput: !!e.detail.value.trim() }) },
  onCtxInput: function(e) { this.setData({ ctx: e.detail.value }) },
  nextStep: function() { if (this.data.hasInput) this.setData({ step: 'context' }) },
  backToInput: function() { this.setData({ step: 'input' }) },
  resetInput: function() { this.setData({ step: 'input', text: '', ctx: '', err: null, res: null, hasInput: false }) },

  submit: function() {
    var self = this
    self.stopLoading()
    self.setData({ step: 'loading', err: null, loadingMsg: MSGS[0] })
    var n = 0
    self._timer = setInterval(function() { n++; self.setData({ loadingMsg: MSGS[n % MSGS.length] }) }, 1200)

    var um = (self.data.ctx ? '关系背景：' + self.data.ctx + '\n\n' : '') +
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
