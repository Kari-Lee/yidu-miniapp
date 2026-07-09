var data = require('../../utils/data')
var Share = require('../../utils/share')
var Releases = require('../../utils/releases')
var Profiles = require('../../utils/profiles')
var H = require('../../utils/history')
var Weekly = require('../../utils/weeklyReport')

function startOfDay(ts) {
  var d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function hasTodayRecord(records) {
  var today = startOfDay(Date.now())
  return (records || []).some(function(record) {
    return record.createdAt && record.createdAt >= today
  })
}

function getTodayScore(report) {
  var points = report && report.temperaturePoints || []
  var today = points[points.length - 1]
  if (!today || !today.hasRecord) return ''
  return today.scoreText + '/100'
}

function buildWeeklyCard() {
  var profiles = Profiles.getProfiles()
  if (!profiles.length) return null
  var cards = profiles.map(function(profile) {
    var records = H.getRecordsByProfile(profile.id)
    var report = Weekly.build(profile, records)
    return {
      profile: profile,
      report: report,
      hasToday: hasTodayRecord(records),
      todayScore: getTodayScore(report)
    }
  })
  cards.sort(function(a, b) {
    if (a.hasToday !== b.hasToday) return a.hasToday ? 1 : -1
    if (a.report.ready !== b.report.ready) return a.report.ready ? -1 : 1
    if (a.report.total !== b.report.total) return b.report.total - a.report.total
    return (b.profile.updatedAt || 0) - (a.profile.updatedAt || 0)
  })
  var best = cards[0]
  var profile = best.profile
  var report = best.report
  var hasToday = best.hasToday
  var todayScore = best.todayScore
  return {
    profileId: profile.id,
    ready: report.ready,
    hasToday: hasToday,
    progress: report.progress,
    countText: report.total + '/' + report.target,
    badge: hasToday ? 'TODAY DONE' : 'TODAY RECORD',
    title: hasToday ? '今天已记录 ' + profile.name + ' 的互动' : '今天还没记录 ' + profile.name + ' 的互动',
    copy: hasToday
      ? '关系温度 ' + todayScore + '｜七日周报 ' + report.total + '/' + report.target + ' 天'
      : '补一句话或一张聊天截图，七日趋势会更准。',
    action: hasToday ? '查看趋势' : '记录今天',
    actionKind: hasToday ? 'report' : 'record'
  }
}

function buildFollowupCard() {
  var records = H.getRecords().filter(function(record) {
    return record.feedback && record.feedback.action === 'sent' && !record.feedback.response
  })
  if (!records.length) return null
  records.sort(function(a, b) {
    var at = a.feedback && a.feedback.updatedAt || a.createdAt || 0
    var bt = b.feedback && b.feedback.updatedAt || b.createdAt || 0
    return bt - at
  })
  var record = records[0]
  return {
    recordId: record.id,
    profileId: record.profileId || '',
    profileName: record.profileName || '这段关系',
    kindLabel: record.kindLabel || '分析记录',
    title: record.title || '上次那句后来怎么样',
    copy: '你标记过「已发」。补一下 Ta 后来回没回，周报会更准。',
    timeText: record.timeText || ''
  }
}

Page({
  data: {
    statusBarHeight: 0,
    activeTab: 'relation',
    dailyQuote: '',
    updateNotice: null,
    showUpdateNotice: false,
    weeklyCard: null,
    followupCard: null,
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
      activeTab: options && options.tab && options.tab !== 'tools' ? options.tab : 'relation'
    })
    this.startMisreadSamples()
  },
  onShow: function() {
    this.refreshRetentionCards()
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
  refreshRetentionCards: function() {
    this.setData({
      weeklyCard: buildWeeklyCard(),
      followupCard: buildFollowupCard()
    })
  },
  goWeeklyCard: function() {
    var card = this.data.weeklyCard
    if (!card) return
    var id = encodeURIComponent(card.profileId)
    if (card.actionKind === 'record') {
      wx.navigateTo({ url: '/pages/profile-detail/profile-detail?id=' + id })
      return
    }
    wx.navigateTo({ url: '/pages/weekly-report/weekly-report?id=' + id })
  },
  openFollowupRecord: function() {
    var card = this.data.followupCard
    if (!card) return
    wx.navigateTo({ url: '/pages/history-detail/history-detail?id=' + encodeURIComponent(card.recordId) })
  },
  markFollowupResponse: function(e) {
    var card = this.data.followupCard
    if (!card) return
    var record = H.getRecord(card.recordId)
    if (!record) return
    var feedback = Object.assign({}, record.feedback || {}, {
      action: 'sent',
      response: e.currentTarget.dataset.value
    })
    H.setRecordFeedback(record.id, feedback)
    this.refreshRetentionCards()
    wx.showToast({ title: '已记入周报', icon: 'success' })
  },
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
