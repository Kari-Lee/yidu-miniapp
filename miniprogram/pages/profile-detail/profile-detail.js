var D = require('../../utils/data')
var Profiles = require('../../utils/profiles')
var H = require('../../utils/history')
var Share = require('../../utils/share')
var ProfileContext = require('../../utils/profileContext')

function safeDecode(v) {
  try { return decodeURIComponent(v) } catch(e) { return v || '' }
}

function findProfile(id) {
  return Profiles.getProfiles().filter(function(item) {
    return item.id === id
  })[0] || null
}

function countBy(records, key) {
  var result = {}
  records.forEach(function(item) {
    var value = key(item)
    if (!value) return
    result[value] = (result[value] || 0) + 1
  })
  return result
}

function labelKind(kind) {
  return {
    translate: '潜台词',
    check: '发不发',
    reply: '回复',
    diagnose: '截图',
    predict: '预测',
    misread: '乱回'
  }[kind] || '记录'
}

function buildWeeklyReport(profile, records) {
  var now = Date.now()
  var weekMs = 7 * 24 * 60 * 60 * 1000
  var weekRecords = (records || []).filter(function(item) {
    return item.createdAt && now - item.createdAt <= weekMs
  })
  var total = weekRecords.length
  var needed = Math.max(0, 3 - total)
  var progress = Math.min(100, Math.round(total / 3 * 100))
  var kindCounts = countBy(weekRecords, function(item) { return item.kind })
  var actionCounts = countBy(weekRecords, function(item) { return item.feedback && item.feedback.action })
  var responseCounts = countBy(weekRecords, function(item) { return item.feedback && item.feedback.response })
  var mainKind = Object.keys(kindCounts).sort(function(a, b) { return kindCounts[b] - kindCounts[a] })[0] || ''
  var sent = actionCounts.sent || 0
  var skipped = actionCounts.skipped || 0
  var thinking = actionCounts.thinking || 0
  var replied = responseCounts.replied || 0
  var weak = (responseCounts.silent || 0) + (responseCounts.cold || 0)
  var status = '采样中'
  var verdict = '再记录 ' + needed + ' 次，就能生成第一份七日关系报告。'
  var trend = '先补足材料，别急着给 ' + profile.name + ' 定性。'
  var advice = '建议先完成一次潜台词翻译或发不发检测，让档案有可比较的记录。'

  if (!needed) {
    if ((kindCounts.check || 0) + (kindCounts.reply || 0) >= 2) {
      status = '行动决策期'
      trend = '这周重点不是看懂 Ta，而是你在反复决定要不要行动。'
    } else if ((kindCounts.translate || 0) >= 2) {
      status = '信号解读期'
      trend = '你这周主要在拆 Ta 的话，说明关系还停在猜测和确认阶段。'
    } else if ((kindCounts.diagnose || 0) + (kindCounts.predict || 0) >= 2) {
      status = '关系复盘期'
      trend = '你已经开始看整体模式，不只是盯着某一句话。'
    } else {
      status = '轻量观察期'
      trend = '记录开始形成连续性，但还需要更多具体互动来判断走向。'
    }

    if (sent && weak >= sent) {
      verdict = '主动后反馈偏弱'
      advice = '下周少追加解释，优先观察 Ta 有没有主动补回应。'
    } else if (skipped > sent) {
      verdict = '克制比推进更多'
      advice = '这不是坏事。下周继续看回应质量，不要用长消息测试短回复的人。'
    } else if (replied > weak && replied > 0) {
      verdict = '回应质量暂时可看'
      advice = '可以轻推进，但每次只推进一小步，别一次性交底。'
    } else if (thinking >= 2) {
      verdict = '你还在观望'
      advice = '下周把问题落到具体一句话上，少脑补，多记录。'
    } else {
      verdict = '关系信号仍不稳定'
      advice = '下周继续记录 Ta 的真实动作，不要只记录自己的情绪波动。'
    }
  }

  return {
    ready: !needed,
    total: total,
    needed: needed,
    progress: progress,
    status: status,
    verdict: verdict,
    trend: trend,
    advice: advice,
    mainKind: mainKind ? labelKind(mainKind) : '暂无',
    sent: sent,
    skipped: skipped,
    thinking: thinking,
    replied: replied,
    weak: weak
  }
}

function buildTodayPlan(profile, latest, records) {
  var count = records ? records.length : 0
  if (!latest) {
    return {
      kicker: 'TODAY · NEW FILE',
      title: '先给这段关系打个底',
      copy: '还没有 ' + profile.name + ' 的分析记录。先上传一段聊天或补一句背景，后面每次判断才不会从零开始。',
      action: 'diagnose',
      actionLabel: '上传聊天截图'
    }
  }
  if (latest.kind === 'translate') {
    return {
      kicker: 'TODAY · SUBTEXT',
      title: '别只审 Ta，一会儿还得回',
      copy: '最近一次在翻译 Ta 的潜台词。今天更适合把分析落到下一句话，别在一句话里反复上诉。',
      action: 'reply',
      actionLabel: '帮我回一句'
    }
  }
  if (latest.kind === 'check') {
    return {
      kicker: 'TODAY · SEND OR NOT',
      title: latest.feedback && latest.feedback.action === 'sent' ? '发都发了，看后续反应' : '今天继续先过一遍风险',
      copy: latest.feedback && latest.feedback.action === 'sent'
        ? '上次你标记已经发出。今天重点不是复盘勇气，是看 Ta 回得像人，还是像自动回复。'
        : '最近一次在纠结发不发。今天如果又想发，先让已读拦一下，别让情绪替你点发送。',
      action: latest.feedback && latest.feedback.action === 'sent' ? 'translate' : 'check',
      actionLabel: latest.feedback && latest.feedback.action === 'sent' ? '翻译 Ta 的回复' : '我这句能不能发'
    }
  }
  if (latest.kind === 'reply' || latest.kind === 'misread') {
    return {
      kicker: 'TODAY · AFTER REPLY',
      title: '上一句已经有了，今天看能不能发',
      copy: '最近一次生成了回复。真正的闭环是发之前再过一遍风险，别让好笑变成事故。',
      action: 'check',
      actionLabel: '检查发送风险'
    }
  }
  if (latest.kind === 'predict') {
    return {
      kicker: 'TODAY · FORECAST',
      title: '预测看完了，今天看动作',
      copy: '关系走向不是靠盯着预测刷新出来的。今天更适合检查一句具体要发的话。',
      action: 'check',
      actionLabel: '我这句能不能发'
    }
  }
  return {
    kicker: count > 2 ? 'TODAY · FILE #' + count : 'TODAY · RELATION',
    title: '今天先别急着发',
    copy: '把和 ' + profile.name + ' 有关的话、截图或想法丢进来，结果会自动归进这个档案。',
    action: 'translate',
    actionLabel: 'Ta 这句话什么意思'
  }
}

Page({
  data: {
    statusBarHeight: 0,
    id: '',
    profile: null,
    records: [],
    latest: null,
    hasRecords: false,
    todayPlan: null,
    weeklyReport: null,
    typeInfo: null,
    emptyType: { label: '未知', emoji: '❔', color: '#8395A7', desc: '还没定性，先别急着给Ta判刑' }
  },

  onLoad: function(options) {
    this.setData({
      statusBarHeight: getApp().globalData.statusBarHeight,
      id: options && options.id ? safeDecode(options.id) : ''
    })
  },

  onShow: function() {
    this.loadProfile()
  },

  loadProfile: function() {
    var profile = findProfile(this.data.id)
    var records = profile ? H.getRecordsByProfile(profile.id) : []
    this.setData({
      profile: profile,
      records: records,
      latest: records[0] || null,
      hasRecords: records.length > 0,
      todayPlan: profile ? buildTodayPlan(profile, records[0] || null, records) : null,
      weeklyReport: profile ? buildWeeklyReport(profile, records) : null,
      typeInfo: profile && D.TI[profile.type] || this.data.emptyType
    })
  },

  goBack: function() {
    wx.navigateBack()
  },

  touchAndGo: function(url) {
    var profile = this.data.profile
    if (!profile) return
    Profiles.touchProfile(profile.id)
    wx.navigateTo({ url: url })
  },

  goDiagnose: function() {
    var profile = this.data.profile
    if (!profile) return
    this.touchAndGo('/pages/diagnose/diagnose?' + ProfileContext.query(profile))
  },

  goMisread: function() {
    var profile = this.data.profile
    if (!profile) return
    var mode = profile.relation === '暧昧对象' || profile.relation === '伴侣' ? 'crush' : 'person'
    this.touchAndGo('/pages/misread/misread?mode=' + mode +
      '&profileRelation=' + encodeURIComponent(profile.relation || '') +
      '&' + ProfileContext.query(profile))
  },

  goCheck: function() {
    var profile = this.data.profile
    if (!profile) return
    this.touchAndGo('/pages/check/check?pType=' + (profile.type || '') + '&' + ProfileContext.query(profile))
  },

  goTranslate: function() {
    var profile = this.data.profile
    if (!profile) return
    this.touchAndGo('/pages/translate/translate?' + ProfileContext.query(profile))
  },

  goTodayAction: function() {
    var plan = this.data.todayPlan
    if (!plan) return
    if (plan.action === 'diagnose') this.goDiagnose()
    else if (plan.action === 'check') this.goCheck()
    else if (plan.action === 'reply') this.goReply()
    else if (plan.action === 'predict') this.goPredict()
    else if (plan.action === 'misread') this.goMisread()
    else this.goTranslate()
  },

  goReply: function() {
    var profile = this.data.profile
    if (!profile) return
    this.touchAndGo('/pages/check/check?mode=reply&pType=' + (profile.type || '') + '&' + ProfileContext.query(profile))
  },

  goPredict: function() {
    var profile = this.data.profile
    if (!profile) return
    this.touchAndGo('/pages/predict/predict?' + ProfileContext.query(profile))
  },

  goEdit: function() {
    var profile = this.data.profile
    if (!profile) return
    wx.navigateTo({ url: '/pages/profiles/profiles?editId=' + encodeURIComponent(profile.id) })
  },

  openHistory: function(e) {
    wx.navigateTo({ url: '/pages/history-detail/history-detail?id=' + e.currentTarget.dataset.id })
  },

  onShareAppMessage: function() {
    return Share.profiles()
  }
})
