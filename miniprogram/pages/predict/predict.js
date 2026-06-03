var D = require('../../utils/data')
var API = require('../../utils/api')
var MSGS = ["扫描关系轨迹", "模拟未来走向"]

Page({
  data: {
    statusBarHeight: 0, step: 'input', text: '', ctx: '', err: null,
    hasInput: false, loadingMsg: '', res: null,
    predBgs: ['#FFF5F3', '#FFF9E6', '#F0FFF4']
  },
  _timer: null,
  onLoad: function() { this.setData({ statusBarHeight: getApp().globalData.statusBarHeight }) },
  goBack: function() { wx.navigateBack() },
  onInput: function(e) { this.setData({ text: e.detail.value, hasInput: !!e.detail.value.trim() }) },
  onCtxInput: function(e) { this.setData({ ctx: e.detail.value }) },
  nextStep: function() { if (this.data.hasInput) this.setData({ step: 'context' }) },
  backToInput: function() { this.setData({ step: 'input' }) },
  resetInput: function() { this.setData({ step: 'input', text: '', ctx: '', err: null, res: null, hasInput: false }) },

  submit: function() {
    var self = this
    self.setData({ step: 'loading', err: null, loadingMsg: MSGS[0] })
    var n = 0
    self._timer = setInterval(function() { n++; self.setData({ loadingMsg: MSGS[n % MSGS.length] }) }, 1200)

    var um = (self.data.ctx ? '关系背景：' + self.data.ctx + '\n\n' : '') +
      (self.data.text.trim() ? '聊天记录：\n' + self.data.text : '')

    API.callAI(D.P.predict, um, null).then(function(res) {
      clearInterval(self._timer)
      self.setData({ step: 'result', res: res })
    }).catch(function(e) {
      clearInterval(self._timer)
      self.setData({ step: 'input', err: e.message || '出错了' })
    })
  }
})
