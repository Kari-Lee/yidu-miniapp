var D = require('../../utils/data')
var H = require('../../utils/history')
var Share = require('../../utils/share')
var Format = require('../../utils/format')
var Report = require('../../utils/report')

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

var POSTERS = {
  anxious: {
    no: '01',
    en: 'ANXIOUS ATTACHMENT',
    headline: '不是恋爱脑\n是把安全感外包了',
    headlineTop: '不是恋爱脑',
    headlineBottom: '是把安全感外包了',
    verdict: '你不是太爱，你只是太怕不被爱。',
    warning: '对方晚回两小时，你已经从热恋脑补到葬礼。',
    caption: '刚测完依恋人格：对方还没跑路，我的脑子先追了八百公里。焦虑型，实锤了。',
    shareTitle: '我的依恋人格：对方没失联，我的安全感先失联了'
  },
  avoidant: {
    no: '02',
    en: 'AVOIDANT ATTACHMENT',
    headline: '不是不需要爱\n是爱一靠近就断网',
    headlineTop: '不是不需要爱',
    headlineBottom: '是爱一靠近就断网',
    verdict: '你以为那叫边界，其实更像紧急撤离路线。',
    warning: '别人刚想认真，你已经在心里写离场通知。',
    caption: '刚测完依恋人格：我不是高冷，我只是每次有人靠近，恋爱系统就自动切飞行模式。',
    shareTitle: '我的依恋人格：嘴上要空间，心里等对方别真走'
  },
  secure: {
    no: '03',
    en: 'SECURE ATTACHMENT',
    headline: '不是没心没肺\n是不用靠猜测恋爱',
    headlineTop: '不是没心没肺',
    headlineBottom: '是不用靠猜测恋爱',
    verdict: '你没有超能力，只是会说人话，也听得懂人话。',
    warning: '唯一风险：太稳定，容易被不稳定的人当成人形急救包。',
    caption: '刚测完依恋人格：安全型。评论区可以怀疑，但不接受嫉妒。',
    shareTitle: '我的依恋人格：不查岗、不试探，也不陪人演失踪'
  },
  disorganized: {
    no: '04',
    en: 'DISORGANIZED ATTACHMENT',
    headline: '不是忽冷忽热\n是追兵逃兵同住',
    headlineTop: '不是忽冷忽热',
    headlineBottom: '是追兵逃兵同住',
    verdict: '你一边怕被丢下，一边亲手把门焊死。',
    warning: '上一秒想抱紧，下一秒想注销整个恋爱账号。',
    caption: '刚测完依恋人格：上午想白头，下午想拉黑。混乱型不是善变，是心里同时住着追兵和逃兵。',
    shareTitle: '我的依恋人格：想被坚定选择，也想随时拔腿就跑'
  }
}

function shuffleQuizOptions() {
  return D.QUIZ.map(function(question) {
    var options = question.a.map(function(text, typeIndex) {
      return { text: text, typeIndex: typeIndex }
    })

    for (var i = options.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1))
      var temp = options[i]
      options[i] = options[j]
      options[j] = temp
    }

    return {
      q: question.q,
      a: options.map(function(option) { return option.text }),
      typeMap: options.map(function(option) { return option.typeIndex })
    }
  })
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
    scoreList: [],
    posterData: null,
    posterPath: '',
    posterSaving: false
  },

  onLoad: function() {
    var app = getApp()
    this._quiz = shuffleQuizOptions()
    this.setData({
      statusBarHeight: app.globalData.statusBarHeight,
      currentQ: this._quiz[0]
    })
    wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
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
      currentQ: this._quiz[qi - 1],
      progress: (qi / D.QUIZ.length) * 100
    })
  },

  answerQ: function(e) {
    var idx = e.currentTarget.dataset.idx
    var self = this
    self.setData({ picked: idx })
    setTimeout(function() {
      var typeIndex = self.data.currentQ.typeMap[idx]
      var answers = self.data.answers.concat([typeIndex])
      var qi = self.data.qi
      if (qi < D.QUIZ.length - 1) {
        self.setData({
          qi: qi + 1,
          answers: answers,
          picked: -1,
          currentQ: self._quiz[qi + 1],
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
          scoreList: scoreList,
          posterData: POSTERS[r.type],
          posterPath: ''
        }, function() {
          setTimeout(function() {
            self.renderPoster().catch(function() {})
          }, 80)
        })
      }
    }, 250)
  },

  retry: function() {
    this._posterPromise = null
    this._quiz = shuffleQuizOptions()
    this.setData({
      qi: 0,
      answers: [],
      picked: -1,
      currentQ: this._quiz[0],
      progress: (1 / D.QUIZ.length) * 100,
      result: null,
      typeInfo: null,
      scoreList: [],
      posterData: null,
      posterPath: '',
      posterSaving: false
    })
  },

  goDiagnose: function() {
    wx.navigateTo({ url: '/pages/diagnose/diagnose' })
  },

  copyResult: function() {
    if (!this.data.typeInfo) return
    var text = Format.quiz(this.data.typeInfo, this.data.scoreList)
    var self = this
    wx.setClipboardData({
      data: text,
      success: function() { self.reportResultEvent('copy', text, 'result') }
    })
  },

  copyShareCaption: function() {
    if (!this.data.posterData) return
    var text = this.data.posterData.caption + '\n\n微信小程序：已读 Yidu'
    var self = this
    wx.setClipboardData({
      data: text,
      success: function() { self.reportResultEvent('copy', text, 'share_caption') }
    })
  },

  reportResultEvent: function(event, text, route) {
    if (!this.data.typeInfo) return
    var payload = {
      task: 'quiz',
      route: route || 'result',
      title: this.data.typeInfo.label || '依恋人格测试',
      summary: this.data.typeInfo.desc || this.data.typeInfo.advice || '',
      source: 'attachment_quiz',
      text: text || Format.quiz(this.data.typeInfo, this.data.scoreList)
    }
    if (event === 'copy') Report.reportToolCopy(payload)
    else if (event === 'share') Report.reportToolShare(payload)
    else if (event === 'poster_save') Report.reportPosterSave(payload)
  },

  renderPoster: function() {
    if (!this.data.posterData || !this.data.typeInfo) return Promise.reject(new Error('暂无测试结果'))
    if (this.data.posterPath) return Promise.resolve(this.data.posterPath)
    if (this._posterPromise) return this._posterPromise

    var self = this
    this._posterPromise = new Promise(function(resolve, reject) {
      wx.createSelectorQuery().in(self).select('#sharePoster').fields({ node: true, size: true }).exec(function(res) {
        var item = res && res[0]
        if (!item || !item.node || !item.width || !item.height) {
          reject(new Error('海报画布加载失败'))
          return
        }
        var canvas = item.node
        var ctx = canvas.getContext('2d')
        var dpr = wx.getSystemInfoSync().pixelRatio || 2
        canvas.width = item.width * dpr
        canvas.height = item.height * dpr
        ctx.scale(dpr, dpr)
        self.drawPoster(ctx, item.width, item.height)
        setTimeout(function() {
          wx.canvasToTempFilePath({
            canvas: canvas,
            fileType: 'png',
            quality: 1,
            destWidth: Math.round(item.width * dpr),
            destHeight: Math.round(item.height * dpr),
            success: function(r) {
              self.setData({ posterPath: r.tempFilePath })
              resolve(r.tempFilePath)
            },
            fail: function() { reject(new Error('海报生成失败')) }
          }, self)
        }, 50)
      })
    })
    this._posterPromise.then(function() {
      self._posterPromise = null
    }, function() {
      self._posterPromise = null
    })
    return this._posterPromise
  },

  drawPoster: function(ctx, width, height) {
    var p = this.data.posterData
    var ti = this.data.typeInfo
    var scores = this.data.scoreList
    var accent = ti.color

    ctx.fillStyle = '#F3F4F8'
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = 'rgba(45,47,51,0.07)'
    ctx.lineWidth = 1
    ctx.font = '900 92px sans-serif'
    ctx.strokeText('YIDU', 18, 88)

    ctx.fillStyle = '#2D2F33'
    ctx.font = '900 10px sans-serif'
    ctx.fillText('YIDU / ATTACHMENT PROFILE', 24, 34)
    ctx.fillStyle = accent
    ctx.fillRect(width - 47, 27, 23, 4)

    ctx.strokeStyle = 'rgba(45,47,51,0.12)'
    ctx.font = '900 104px sans-serif'
    ctx.strokeText(p.no, width - 128, 132)

    ctx.fillStyle = accent
    ctx.font = '900 10px sans-serif'
    ctx.fillText(p.en, 24, 126)

    ctx.fillStyle = '#2D2F33'
    drawLines(ctx, p.headline.split('\n'), 24, 151, 31, 37, '900 31px sans-serif')

    ctx.fillStyle = 'rgba(45,47,51,0.58)'
    drawWrappedText(ctx, p.verdict, 24, 235, width - 48, 17, '700 12px sans-serif', 2)

    var darkY = 277
    roundRect(ctx, 16, darkY, width - 32, 106, 18)
    ctx.fillStyle = '#2D2F33'
    ctx.fill()
    ctx.fillStyle = accent
    ctx.font = '900 9px sans-serif'
    ctx.fillText('RELATIONSHIP WARNING', 34, darkY + 25)
    ctx.fillStyle = '#FFFFFF'
    drawWrappedText(ctx, p.warning, 34, darkY + 49, width - 68, 20, '900 15px sans-serif', 3)

    ctx.fillStyle = '#2D2F33'
    ctx.font = '900 10px sans-serif'
    ctx.fillText('YOUR FOUR-DIMENSION SCORE', 24, 407)

    var y = 426
    scores.forEach(function(item, index) {
      ctx.fillStyle = index === 0 ? '#2D2F33' : 'rgba(45,47,51,0.62)'
      ctx.font = '700 11px sans-serif'
      ctx.fillText(item.label, 24, y + 7)
      ctx.fillStyle = 'rgba(45,47,51,0.08)'
      roundRect(ctx, 82, y, width - 132, 7, 4)
      ctx.fill()
      ctx.fillStyle = item.color
      roundRect(ctx, 82, y, Math.max(7, (width - 132) * item.pct / 100), 7, 4)
      ctx.fill()
      ctx.fillStyle = '#2D2F33'
      ctx.font = '900 11px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(item.pct + '%', width - 24, y + 8)
      ctx.textAlign = 'left'
      y += 19
    })

    ctx.strokeStyle = 'rgba(45,47,51,0.1)'
    ctx.beginPath()
    ctx.moveTo(24, height - 55)
    ctx.lineTo(width - 24, height - 55)
    ctx.stroke()
    ctx.fillStyle = '#2D2F33'
    ctx.font = '900 11px sans-serif'
    ctx.fillText('微信小程序｜已读 Yidu', 24, height - 31)
    ctx.fillStyle = 'rgba(45,47,51,0.42)'
    ctx.font = '600 9px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText('24Q RELATIONSHIP TEST', width - 24, height - 31)
    ctx.textAlign = 'left'
  },

  savePoster: function() {
    if (this.data.posterSaving) return
    var self = this
    self.setData({ posterSaving: true })
    wx.showLoading({ title: '生成海报中' })
    self.renderPoster().then(function(path) {
      return new Promise(function(resolve, reject) {
        wx.saveImageToPhotosAlbum({
          filePath: path,
          success: resolve,
          fail: reject
        })
      })
    }).then(function() {
      wx.hideLoading()
      self.setData({ posterSaving: false })
      self.reportResultEvent('poster_save', '', 'poster')
      wx.showToast({ title: '已保存到相册', icon: 'success' })
    }).catch(function(err) {
      wx.hideLoading()
      self.setData({ posterSaving: false })
      if (err && err.errMsg && err.errMsg.indexOf('auth deny') !== -1) {
        wx.showModal({
          title: '需要相册权限',
          content: '开启相册权限后，才能保存结果海报。',
          confirmText: '去设置',
          success: function(r) { if (r.confirm) wx.openSetting() }
        })
        return
      }
      wx.showToast({ title: (err && err.message) || '保存失败，请重试', icon: 'none' })
    })
  },

  onShareAppMessage: function() {
    this.reportResultEvent('share', '', 'app_message')
    var share = Share.quiz(this.data.typeInfo && this.data.typeInfo.label)
    if (this.data.posterData) share.title = this.data.posterData.shareTitle
    if (this.data.posterPath) share.imageUrl = this.data.posterPath
    return share
  },

  onShareTimeline: function() {
    this.reportResultEvent('share', '', 'timeline')
    var share = {
      title: this.data.posterData ? this.data.posterData.shareTitle : '24题测出你的依恋人格',
      query: ''
    }
    if (this.data.posterPath) share.imageUrl = this.data.posterPath
    return share
  }
})

function roundRect(ctx, x, y, width, height, radius) {
  var r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function drawLines(ctx, lines, x, y, fontSize, lineHeight, font) {
  ctx.font = font || ('900 ' + fontSize + 'px sans-serif')
  lines.forEach(function(line, index) {
    ctx.fillText(line, x, y + index * lineHeight)
  })
}

function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, font, maxLines) {
  ctx.font = font
  var lines = []
  var line = ''
  for (var i = 0; i < text.length; i++) {
    var test = line + text[i]
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = text[i]
      if (lines.length >= maxLines - 1) break
    } else {
      line = test
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  lines.forEach(function(item, index) {
    ctx.fillText(item, x, y + index * lineHeight)
  })
}
