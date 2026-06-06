var D = require('../../utils/data')
var API = require('../../utils/api')
var H = require('../../utils/history')
var N = require('../../utils/normalize')
var Share = require('../../utils/share')
var Format = require('../../utils/format')
var MSGS = ["解码潜台词", "翻译真实意图"]

Page({
  data: {
    statusBarHeight: 0, step: 'input', text: '', err: null,
    hasInput: false, submitting: false, loadingMsg: '', res: null,
    colors: ['rgba(225,112,85,0.85)', 'rgba(230,168,23,0.85)', 'rgba(99,110,114,0.85)']
  },
  _timer: null,
  onLoad: function() { this.setData({ statusBarHeight: getApp().globalData.statusBarHeight }) },
  onUnload: function() { this.stopLoading() },
  goBack: function() { wx.navigateBack() },
  stopLoading: function() {
    if (!this._timer) return
    clearInterval(this._timer)
    this._timer = null
  },
  onInput: function(e) { this.setData({ text: e.detail.value, hasInput: !!e.detail.value.trim() }) },
  resetInput: function() {
    this._submitting = false
    this.setData({ step: 'input', text: '', err: null, res: null, hasInput: false, submitting: false })
  },

  submit: function() {
    if (this._submitting || !this.data.text.trim()) return
    var self = this
    self._submitting = true
    self.stopLoading()
    self.setData({ step: 'loading', err: null, submitting: true, loadingMsg: MSGS[0] })
    var n = 0
    self._timer = setInterval(function() { n++; self.setData({ loadingMsg: MSGS[n % MSGS.length] }) }, 1200)

    API.callAI(D.P.translate, 'Ta说的话：\n' + self.data.text, null, null, {
      onRetry: function() { self.setData({ loadingMsg: '连接波动，正在自动重试' }) }
    }).then(function(res) {
      self.stopLoading()
      self._submitting = false
      res = N.normalizeTranslate(res, self.data.text)
      var first = res.translations && res.translations[0]
      H.addRecord({
        kind: 'translate',
        kindLabel: '潜台词',
        title: first ? first.original : '潜台词翻译',
        summary: first ? first.verdict : '已生成潜台词分析',
        input: self.data.text.slice(0, 80),
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
    return Share.translate()
  },

  copyResult: function() {
    if (!this.data.res) return
    wx.setClipboardData({ data: Format.translate(this.data.res) })
  }
})
