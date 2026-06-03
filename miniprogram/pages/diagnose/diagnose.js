var D = require('../../utils/data')
var API = require('../../utils/api')

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

Page({
  data: {
    statusBarHeight: 0, step: 'input', text: '', ctx: '', imgs: [], err: null,
    hasInput: false, loadingMsg: '', res: null,
    userTI: null, partnerTI: null, userGrad: '', partnerGrad: '', userBg: '', partnerBg: ''
  },
  _timer: null,

  onLoad: function() {
    this.setData({ statusBarHeight: getApp().globalData.statusBarHeight })
  },

  goBack: function() { wx.navigateBack() },

  onInput: function(e) {
    this.setData({ text: e.detail.value, hasInput: !!(e.detail.value.trim() || this.data.imgs.length) })
  },

  onCtxInput: function(e) { this.setData({ ctx: e.detail.value }) },

  chooseImg: function() {
    var self = this
    wx.chooseImage({
      count: 9, sizeType: ['compressed'],
      success: function(r) {
        var paths = self.data.imgs.concat(r.tempFilePaths)
        self.setData({ imgs: paths, hasInput: true })
      }
    })
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
    self.setData({ step: 'loading', err: null, loadingMsg: MSGS[0] })
    var n = 0
    self._timer = setInterval(function() { n++; self.setData({ loadingMsg: MSGS[n % MSGS.length] }) }, 1200)

    var um = (self.data.ctx ? '关系背景：' + self.data.ctx + '\n\n' : '') +
      (self.data.text.trim() ? '聊天记录：\n' + self.data.text : '请分析这些聊天记录截图')

    // TODO: 图片需要转base64传给后端，这里先只传文本
    API.callAI(D.P.diagnose, um, null).then(function(res) {
      clearInterval(self._timer)
      var ut = D.TI[res.user_type] || D.TI.secure
      var pt = D.TI[res.partner_type] || D.TI.secure
      self.setData({
        step: 'result', res: res,
        userTI: ut, partnerTI: pt,
        userGrad: GRADS[res.user_type] || GRADS.secure,
        partnerGrad: GRADS[res.partner_type] || GRADS.secure,
        userBg: BGS[res.user_type] || BGS.secure,
        partnerBg: BGS[res.partner_type] || BGS.secure,
      })
    }).catch(function(e) {
      clearInterval(self._timer)
      self.setData({ step: 'input', err: e.message || '出错了' })
    })
  }
})
