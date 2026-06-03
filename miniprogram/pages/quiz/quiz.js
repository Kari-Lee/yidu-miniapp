var D = require('../../utils/data')
var H = require('../../utils/history')
var Share = require('../../utils/share')
var Format = require('../../utils/format')

var GRADS = {
  anxious: "linear-gradient(135deg,#E17055,#D63031,#C0392B)",
  avoidant: "linear-gradient(135deg,#74B9FF,#0984E3,#0652DD)",
  secure: "linear-gradient(135deg,#55EFC4,#00B894,#00896F)",
  disorganized: "linear-gradient(135deg,#A29BFE,#6C5CE7,#5542D6)"
}

var BGS = {
  anxious: "rgba(225,112,85,0.08)",
  avoidant: "rgba(9,132,227,0.08)",
  secure: "rgba(0,184,148,0.08)",
  disorganized: "rgba(108,92,231,0.08)"
}

Page({
  data: {
    statusBarHeight: 0,
    qi: 0,
    answers: [],
    picked: -1,
    total: D.QUIZ.length,
    currentQ: D.QUIZ[0],
    progress: (1 / D.QUIZ.length) * 100,
    letters: ['A','B','C','D'],
    result: null,
    typeInfo: null,
    typeGrad: '',
    typeBg: '',
    scoreList: []
  },

  onLoad: function() {
    var app = getApp()
    this.setData({ statusBarHeight: app.globalData.statusBarHeight })
  },

  goBack: function() { wx.navigateBack() },

  prevQ: function() {
    var qi = this.data.qi
    if (qi <= 0) return
    var answers = this.data.answers.slice(0, -1)
    this.setData({
      qi: qi - 1,
      answers: answers,
      picked: -1,
      currentQ: D.QUIZ[qi - 1],
      progress: (qi / D.QUIZ.length) * 100
    })
  },

  answerQ: function(e) {
    var idx = e.currentTarget.dataset.idx
    var self = this
    self.setData({ picked: idx })
    setTimeout(function() {
      var answers = self.data.answers.concat([idx])
      var qi = self.data.qi
      if (qi < D.QUIZ.length - 1) {
        self.setData({
          qi: qi + 1,
          answers: answers,
          picked: -1,
          currentQ: D.QUIZ[qi + 1],
          progress: ((qi + 2) / D.QUIZ.length) * 100
        })
      } else {
        // 计算结果
        var r = D.calcQuiz(answers)
        var ti = D.TI[r.type]
        var scoreList = Object.keys(r.scores).map(function(k) {
          var pct = Math.round((r.scores[k] / D.QUIZ.length) * 100)
          return { key:k, emoji:D.TI[k].emoji, label:D.TI[k].label, color:D.TI[k].color, pct:pct, grad:GRADS[k] }
        })
        H.addRecord({
          kind: 'quiz',
          kindLabel: '依恋测试',
          title: ti.label,
          summary: ti.desc,
          result: { type: r.type, scores: r.scores, label: ti.label, desc: ti.desc }
        })
        self.setData({
          answers: answers,
          picked: -1,
          result: r,
          typeInfo: ti,
          typeGrad: GRADS[r.type],
          typeBg: BGS[r.type],
          scoreList: scoreList
        })
      }
    }, 250)
  },

  retry: function() {
    this.setData({
      qi: 0,
      answers: [],
      picked: -1,
      currentQ: D.QUIZ[0],
      progress: (1 / D.QUIZ.length) * 100,
      result: null,
      typeInfo: null,
      scoreList: []
    })
  },

  goDiagnose: function() {
    wx.navigateTo({ url: '/pages/diagnose/diagnose' })
  },

  copyResult: function() {
    if (!this.data.typeInfo) return
    wx.setClipboardData({
      data: Format.quiz(this.data.typeInfo, this.data.scoreList)
    })
  },

  onShareAppMessage: function() {
    return Share.quiz(this.data.typeInfo && this.data.typeInfo.label)
  }
})
