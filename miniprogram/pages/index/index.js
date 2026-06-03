var data = require('../../utils/data')

Page({
  data: {
    statusBarHeight: 0,
    dailyQuote: '',
    types: [
      { key:'anxious', emoji:'🔥', label:'焦虑型', color:'#E17055', desc:'恋爱中的人形追踪器' },
      { key:'avoidant', emoji:'🧊', label:'回避型', color:'#0984E3', desc:'感情中的专业逃跑运动员' },
      { key:'secure', emoji:'🌿', label:'安全型', color:'#00B894', desc:'你到底是怎么做到的' },
      { key:'disorganized', emoji:'🌀', label:'混乱型', color:'#6C5CE7', desc:'爱情里的薛定谔的猫' },
    ]
  },
  onLoad: function() {
    var app = getApp()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      dailyQuote: data.getDailyQuote()
    })
  },
  goQuiz: function() { wx.navigateTo({ url: '/pages/quiz/quiz' }) },
  goDiagnose: function() { wx.navigateTo({ url: '/pages/diagnose/diagnose' }) },
  goTranslate: function() { wx.navigateTo({ url: '/pages/translate/translate' }) },
  goCheck: function() { wx.navigateTo({ url: '/pages/check/check' }) },
  goPredict: function() { wx.navigateTo({ url: '/pages/predict/predict' }) },
})
