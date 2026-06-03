var D = require('../../utils/data')
var API = require('../../utils/api')
var H = require('../../utils/history')
var N = require('../../utils/normalize')
var Share = require('../../utils/share')
var Format = require('../../utils/format')
var MSGS = ["评估杀伤力", "模拟Ta反应"]

Page({
  data: {
    statusBarHeight: 0, step: 'input', text: '', pType: '', err: null,
    hasInput: false, loadingMsg: '', res: null,
    typeOptions: [
      { key:'avoidant', emoji:'🧊', label:'回避型', color:'#0984E3', bg:'rgba(9,132,227,0.08)' },
      { key:'anxious', emoji:'🔥', label:'焦虑型', color:'#E17055', bg:'rgba(225,112,85,0.08)' },
      { key:'secure', emoji:'🌿', label:'安全型', color:'#00B894', bg:'rgba(0,184,148,0.08)' },
      { key:'disorganized', emoji:'🌀', label:'混乱型', color:'#6C5CE7', bg:'rgba(108,92,231,0.08)' },
    ]
  },
  _timer: null,
  onLoad: function(options) {
    this.setData({
      statusBarHeight: getApp().globalData.statusBarHeight,
      pType: options && options.pType ? options.pType : ''
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
  pickType: function(e) { this.setData({ pType: e.currentTarget.dataset.key }) },
  resetInput: function() { this.setData({ step: 'input', text: '', pType: '', err: null, res: null, hasInput: false }) },

  submit: function() {
    if (!this.data.text.trim()) return
    var self = this
    self.stopLoading()
    self.setData({ step: 'loading', err: null, loadingMsg: MSGS[0] })
    var n = 0
    self._timer = setInterval(function() { n++; self.setData({ loadingMsg: MSGS[n % MSGS.length] }) }, 1200)

    var typeLabel = self.data.pType ? (D.TI[self.data.pType] || {}).label || '未知' : '未知'
    var um = '对方类型：' + typeLabel + '\n\n我想发：' + self.data.text

    API.callAI(D.P.check, um, null).then(function(res) {
      self.stopLoading()
      res = N.normalizeCheck(res)
      H.addRecord({
        kind: 'check',
        kindLabel: '发不发',
        title: res.verdict || '消息检测',
        summary: res.reason || res.prediction || '已生成发送建议',
        input: self.data.text.slice(0, 80),
        result: res
      })
      self.setData({ step: 'result', res: res })
    }).catch(function(e) {
      self.stopLoading()
      self.setData({ step: 'input', err: e.message || '出错了' })
    })
  },

  onShareAppMessage: function() {
    return Share.check(this.data.res && this.data.res.verdict)
  },

  copyResult: function() {
    if (!this.data.res) return
    wx.setClipboardData({ data: Format.check(this.data.res) })
  }
})
