var D = require('../../utils/data')
var API = require('../../utils/api')
var H = require('../../utils/history')
var N = require('../../utils/normalize')
var Share = require('../../utils/share')
var MSGS = ["解码潜台词", "翻译真实意图"]

Page({
  data: {
    statusBarHeight: 0, step: 'input', text: '', err: null,
    hasInput: false, loadingMsg: '', res: null,
    colors: ['rgba(225,112,85,0.85)', 'rgba(230,168,23,0.85)', 'rgba(99,110,114,0.85)']
  },
  _timer: null,
  onLoad: function() { this.setData({ statusBarHeight: getApp().globalData.statusBarHeight }) },
  goBack: function() { wx.navigateBack() },
  onInput: function(e) { this.setData({ text: e.detail.value, hasInput: !!e.detail.value.trim() }) },
  resetInput: function() { this.setData({ step: 'input', text: '', err: null, res: null, hasInput: false }) },

  submit: function() {
    if (!this.data.text.trim()) return
    var self = this
    self.setData({ step: 'loading', err: null, loadingMsg: MSGS[0] })
    var n = 0
    self._timer = setInterval(function() { n++; self.setData({ loadingMsg: MSGS[n % MSGS.length] }) }, 1200)

    API.callAI(D.P.translate, 'Ta说的话：\n' + self.data.text, null).then(function(res) {
      clearInterval(self._timer)
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
      self.setData({ step: 'result', res: res })
    }).catch(function(e) {
      clearInterval(self._timer)
      self.setData({ step: 'input', err: e.message || '出错了' })
    })
  },

  onShareAppMessage: function() {
    return Share.translate()
  }
})
