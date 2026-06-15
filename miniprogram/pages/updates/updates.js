var Releases = require('../../utils/releases')
var Share = require('../../utils/share')

Page({
  data: {
    statusBarHeight: 0,
    releases: []
  },

  onLoad: function() {
    var latest = Releases.getLatest()
    if (latest) Releases.markSeen(latest.id)
    this.setData({
      statusBarHeight: getApp().globalData.statusBarHeight,
      releases: Releases.getAll()
    })
  },

  goBack: function() {
    wx.navigateBack()
  },

  openAction: function(e) {
    var url = e.currentTarget.dataset.url
    if (url) wx.navigateTo({ url: url })
  },

  onShareAppMessage: function() {
    return Share.home()
  }
})
