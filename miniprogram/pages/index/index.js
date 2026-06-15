var data = require('../../utils/data')
var Share = require('../../utils/share')
var Releases = require('../../utils/releases')

Page({
  data: {
    statusBarHeight: 0,
    activeTab: 'test',
    dailyQuote: '',
    updateNotice: null,
    showUpdateNotice: false,
    misreadSample: {
      input: '你吃饭了吗',
      output: '随便吃了点。前两天朋友从筑地给我顺了块蓝鳍金枪鱼中腹，我解冻手法不太行，有点辜负……那个米一年就给我寄二十斤，吃一斤少一斤，所以我现在不太敢吃饭。'
    },
    types: [
      { key:'anxious', emoji:'🔥', label:'焦虑型', color:'#E17055', desc:'恋爱中的人形追踪器' },
      { key:'avoidant', emoji:'🧊', label:'回避型', color:'#0984E3', desc:'感情中的专业逃跑运动员' },
      { key:'secure', emoji:'🌿', label:'安全型', color:'#00B894', desc:'你到底是怎么做到的' },
      { key:'disorganized', emoji:'🌀', label:'混乱型', color:'#6C5CE7', desc:'爱情里的薛定谔的猫' },
    ]
  },
  _misreadTimer: null,
  onLoad: function(options) {
    var app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      dailyQuote: data.getDailyQuote(),
      activeTab: options && options.tab ? options.tab : 'test'
    })
    this.startMisreadSamples()
  },
  onShow: function() {
    if (!Releases.shouldShowLatest()) return
    this.setData({
      updateNotice: Releases.getLatest(),
      showUpdateNotice: true
    })
  },
  onUnload: function() {
    if (this._misreadTimer) clearInterval(this._misreadTimer)
  },
  startMisreadSamples: function() {
    var self = this
    var samples = [
      {
        input: '你吃饭了吗',
        output: '随便吃了点。前两天朋友从筑地给我顺了块蓝鳍金枪鱼中腹，我解冻手法不太行，有点辜负……那个米一年就给我寄二十斤，吃一斤少一斤，所以我现在不太敢吃饭。'
      },
      {
        input: '我就是比很多人都厉害，我值得，我不是自恋，你是错的，我在这里是个学生，但，我不只是个学生，我是李大毛',
        output: '我就是比很多人都厉害，我值得，我不是自恋，你是错的，我在这里是个学生，但，我不只是个学生，大家好，我是蔡徐坤'
      }
    ]
    var index = 0
    self._misreadTimer = setInterval(function() {
      index = (index + 1) % samples.length
      self.setData({ misreadSample: samples[index] })
    }, 5000)
  },
  goQuiz: function() { wx.navigateTo({ url: '/pages/quiz/quiz' }) },
  goDiagnose: function() { wx.navigateTo({ url: '/pages/diagnose/diagnose' }) },
  goTranslate: function() { wx.navigateTo({ url: '/pages/translate/translate' }) },
  goCheck: function() { wx.navigateTo({ url: '/pages/check/check' }) },
  goMisread: function() { wx.navigateTo({ url: '/pages/misread/misread' }) },
  goPredict: function() { wx.navigateTo({ url: '/pages/predict/predict' }) },
  goHistory: function() { wx.navigateTo({ url: '/pages/history/history' }) },
  goProfiles: function() { wx.navigateTo({ url: '/pages/profiles/profiles' }) },
  goUpdates: function() {
    this.markUpdateSeen()
    this.setData({ showUpdateNotice: false })
    wx.navigateTo({ url: '/pages/updates/updates' })
  },
  markUpdateSeen: function() {
    var notice = this.data.updateNotice || Releases.getLatest()
    if (notice) Releases.markSeen(notice.id)
  },
  closeUpdateNotice: function() {
    this.markUpdateSeen()
    this.setData({ showUpdateNotice: false })
  },
  tryLatestUpdate: function() {
    var notice = this.data.updateNotice
    this.markUpdateSeen()
    this.setData({ showUpdateNotice: false })
    if (notice && notice.actionUrl) wx.navigateTo({ url: notice.actionUrl })
  },
  noop: function() {},
  switchHomeTab: function(e) { this.setData({ activeTab: e.currentTarget.dataset.tab }) },
  onShareAppMessage: function() { return Share.home() },
})
