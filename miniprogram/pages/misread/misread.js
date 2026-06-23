var API = require('../../utils/api')
var ChatImages = require('../../utils/chatImages')
var H = require('../../utils/history')
var Share = require('../../utils/share')
var ProfileContext = require('../../utils/profileContext')
var Prompt = require('../../utils/misreadPrompt')
var Quality = require('../../utils/misreadQuality')
var Report = require('../../utils/report')

var PLACEHOLDERS = [
  '我是世界上最厉害的人',
  '在吗',
  '你想我吗？',
  '我最近真的想开了',
  '炒粉干被油溅到了'
]
var LOADING_MESSAGES = ['正在认真地读歪……', '正在假装没看懂……']
var VARIANT_KEY = 'yidu_misread_reply_variant_v1'
var FEEDBACK_PROMPT_VERSION = 'misread_v2'

function safeDecode(value) {
  try { return decodeURIComponent(value || '') } catch (e) { return value || '' }
}

function hasInput(text, imgs) {
  return !!((text || '').trim() || (imgs && imgs.length))
}

function nextReplyVariant() {
  var value = 0
  try { value = Number(wx.getStorageSync(VARIANT_KEY) || 0) } catch (e) {}
  value = (value + 1) % 10000
  try { wx.setStorageSync(VARIANT_KEY, value) } catch (e) {}
  return value
}

function createBatchId() {
  return 'b_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10)
}

function recentReplies(mode) {
  return Quality.getRecent(mode, 30)
}

function fallbackResult(source, mode, variant) {
  return Prompt.getFallback(source, mode, variant, recentReplies(mode))
}

function normalizeWarning(value) {
  value = String(value || 'Ta可能会停顿三秒').trim()
  var explanationMarkers = [
    '制造', '反差', '甜藏', '暗藏', '实则', '语气',
    '把抽象', '转成具体', '炸点', '创作', '阅读失败'
  ]
  var explainsMethod = explanationMarkers.some(function(marker) {
    return value.indexOf(marker) !== -1
  })
  var predictsMind = /(假装|偷偷|反而|觉得你|被反将|压力转移|太老实|收藏|拉黑|翻白眼)/
  if (explainsMethod || predictsMind.test(value)) return '预警：Ta可能会停顿三秒'
  return value.indexOf('预警：') === 0 ? value : '预警：' + value
}

function normalizeResult(raw, fallbackSource, mode) {
  raw = raw || {}
  var safe = raw.safe !== false && !raw.safety_message
  var source = String(raw.source || fallbackSource || '聊天截图').trim()
  if (!safe) {
    return {
      safe: false,
      mode: mode,
      source: source,
      safety_message: raw.safety_message || '对方好像不是在发疯，是真的不太好。这条建议认真回。',
      serious_reply: raw.serious_reply || ''
    }
  }

  var list = raw.replies || raw.candidates || raw.options || []
  if (!Array.isArray(list) && raw.text) list = String(raw.text).split(/\n+/)
  list = (Array.isArray(list) ? list : []).map(function(item) {
    if (typeof item === 'string') {
      return { type: '阅读失败', text: item.trim(), warning: '预警：Ta可能会停顿三秒' }
    }
    item = item || {}
    return {
      type: String(item.type || item.weapon || item.label || '阅读失败').trim(),
      text: String(item.text || item.reply || item.content || '').trim(),
      warning: normalizeWarning(item.warning || item.risk || item.consequence)
    }
  }).filter(function(item) {
    return item.text
  }).slice(0, 3)

  if (list.length !== 3) throw new Error('这批回复没生成完整，请再试一次')
  return { safe: true, mode: mode, source: source, replies: list }
}

function modeFromRelation(relation) {
  return relation === '暧昧对象' || relation === '伴侣' ? 'crush' : 'person'
}

function buildReviewMessage(source, replies, issues) {
  var drafts = (replies || []).map(function(item, index) {
    return (index + 1) + '. [' + (item.type || '') + '] ' + (item.text || '')
  }).join('\n')
  var problems = (issues || []).length
    ? '本地质检命中的问题：\n- ' + issues.join('\n- ')
    : '本地质检没报具体问题，但整体不够好笑，请整体抬高质量。'
  return [
    source ? '对方原话：\n' + source : '',
    '首轮草稿（逐条）：\n' + drafts,
    problems,
    '请按终审编辑模式处理：完全合格的原样保留，命中问题的从零重写，最终仍输出严格 JSON 的三条回复。'
  ].filter(Boolean).join('\n\n')
}

Page({
  data: {
    statusBarHeight: 0,
    step: 'input',
    text: '',
    imgs: [],
    mode: 'person',
    modeHint: '随便乱，后果自负',
    placeholder: PLACEHOLDERS[0],
    hasInput: false,
    submitting: false,
    loadingMsg: LOADING_MESSAGES[0],
    err: '',
    res: null,
    copiedIndex: -1,
    batchId: '',
    feedbackStates: [],
    feedbackTarget: -1,
    posterPath: '',
    posterReplyIndex: -1,
    posterSaving: false,
    profileId: '',
    profileName: '',
    profileRelation: '',
    ctx: '',
    previousWeapons: []
  },

  _placeholderTimer: null,
  _loadingTimer: null,
  _copyTimer: null,
  _posterPromise: null,
  _submitting: false,
  _replyVariant: 0,

  onLoad: function(options) {
    options = options || {}
    var profileId = safeDecode(options.profileId)
    var profile = profileId ? ProfileContext.findProfile(profileId) : null
    var relation = profile ? profile.relation : safeDecode(options.profileRelation)
    var mode = options.mode === 'crush' || options.mode === 'person'
      ? options.mode
      : modeFromRelation(relation)
    var text = safeDecode(options.text)
    this.setData({
      statusBarHeight: getApp().globalData.statusBarHeight,
      text: text,
      hasInput: !!text,
      mode: mode,
      modeHint: mode === 'crush' ? '乱中带甜，点到为止' : '随便乱，后果自负',
      profileId: profileId,
      profileName: profile ? profile.name : safeDecode(options.profileName),
      profileRelation: relation || '',
      ctx: safeDecode(options.ctx)
    })
    this.startPlaceholder()
  },

  onShow: function() {
    if (this.data.step === 'input') this.startPlaceholder()
  },

  onHide: function() {
    this.stopPlaceholder()
  },

  onUnload: function() {
    this.stopPlaceholder()
    this.stopLoading()
    if (this._copyTimer) clearTimeout(this._copyTimer)
  },

  startPlaceholder: function() {
    var self = this
    if (self._placeholderTimer) return
    var index = Math.max(0, PLACEHOLDERS.indexOf(self.data.placeholder))
    self._placeholderTimer = setInterval(function() {
      index = (index + 1) % PLACEHOLDERS.length
      self.setData({ placeholder: PLACEHOLDERS[index] })
    }, 2200)
  },

  stopPlaceholder: function() {
    if (!this._placeholderTimer) return
    clearInterval(this._placeholderTimer)
    this._placeholderTimer = null
  },

  stopLoading: function() {
    if (!this._loadingTimer) return
    clearInterval(this._loadingTimer)
    this._loadingTimer = null
  },

  goBack: function() {
    wx.navigateBack()
  },

  goHomeTab: function(e) {
    var tab = e.currentTarget.dataset.tab || 'tools'
    wx.reLaunch({ url: '/pages/index/index?tab=' + tab })
  },

  onInput: function(e) {
    var text = e.detail.value
    this.setData({ text: text, hasInput: hasInput(text, this.data.imgs) })
  },

  tryExample: function() {
    var text = this.data.placeholder
    this.stopPlaceholder()
    this.setData({ text: text, hasInput: true })
  },

  pickMode: function(e) {
    var mode = e.currentTarget.dataset.mode
    this.setData({
      mode: mode,
      modeHint: mode === 'crush' ? '乱中带甜，点到为止' : '随便乱，后果自负'
    })
  },

  chooseImg: function() {
    var self = this
    var remaining = ChatImages.MAX_IMAGES - self.data.imgs.length
    if (remaining <= 0) {
      wx.showToast({ title: '这组截图已经够完整了', icon: 'none' })
      return
    }
    wx.chooseImage({
      count: Math.min(9, remaining),
      sizeType: ['compressed'],
      success: function(result) {
        var paths = self.data.imgs.map(function(item) {
          return item.originalPath || item.path
        }).concat(result.tempFilePaths)
        wx.showLoading({ title: '优化截图中' })
        ChatImages.optimizeImages(paths).then(function(imgs) {
          wx.hideLoading()
          self.setData({ imgs: imgs, hasInput: hasInput(self.data.text, imgs) })
        }).catch(function() {
          wx.hideLoading()
          wx.showToast({ title: '图片处理失败，请重选', icon: 'none' })
        })
      }
    })
  },

  previewImg: function(e) {
    var index = e.currentTarget.dataset.index
    var urls = this.data.imgs.map(function(item) { return item.path })
    wx.previewImage({ current: urls[index], urls: urls })
  },

  removeImg: function(e) {
    var imgs = this.data.imgs.slice()
    imgs.splice(e.currentTarget.dataset.index, 1)
    this.setData({ imgs: imgs, hasInput: hasInput(this.data.text, imgs) })
  },

  buildMessage: function() {
    var modeLock = this.data.mode === 'crush'
      ? '唯一模式：Crush。必须幽默打底、微量甜，禁止套用“人”模式的攻击和隔离逻辑。'
      : '唯一模式：人。必须火力全开地阅读失败，禁止暧昧、表白和推进关系。'
    var oppositeReplies = Quality.getOppositeReplies(this.data.text, this.data.mode)
    var previousReplies = this.data.res && this.data.res.replies
      ? this.data.res.replies.map(function(item) { return item.text }).filter(Boolean)
      : []
    var recent = Quality.getRecent(this.data.mode, 12)
    var recentWeapons = []
    var recentSnippets = []
    recent.forEach(function(item) {
      if (item.weapon && recentWeapons.indexOf(item.weapon) === -1) recentWeapons.push(item.weapon)
      var snippet = (item.text || '').slice(0, 24)
      if (snippet) recentSnippets.push(snippet)
    })
    var recentNovelty = recent.length
      ? '跨对话新奇约束：最近在别的对话里已经用过这些武器【' + recentWeapons.join('、') + '】和这些包袱：\n' + recentSnippets.join('\n') + '\n本批必须换武器、换包袱、换职业/意象/结尾，禁止复用以上任何套路。'
      : ''
    var lines = [
      modeLock,
      this.data.profileName ? '关系档案：' + this.data.profileName + '（' + (this.data.profileRelation || '未知关系') + '）' : '',
      this.data.ctx ? '关系背景：\n' + this.data.ctx : '',
      this.data.text.trim() ? '对方消息原文：\n' + this.data.text.trim() : '请从聊天截图中识别对方最新一条需要回复的消息。',
      '本地路由提示：\n' + Prompt.getRouteHint(this.data.text, this.data.mode),
      this.data.imgs.length ? '请结合所附聊天截图，只生成针对最新消息的回复。' : '',
      this.data.previousWeapons.length ? '上一批已使用武器：' + this.data.previousWeapons.join('、') + '。本批必须换武器。' : '',
      previousReplies.length ? '上一批回复如下，本批禁止复用相同句子、鸡汤、通知和核心包袱：\n' + previousReplies.join('\n') : '',
      recentNovelty,
      oppositeReplies.length ? '同一句话在另一模式出现过以下回复，本模式禁止复用其句式、包袱和结尾：\n' + oppositeReplies.join('\n') : ''
    ]
    return lines.filter(Boolean).join('\n\n')
  },

  requestResult: function(message, options) {
    var preset = !this.data.imgs.length && !this.data.previousWeapons.length
      ? Prompt.getPreset(this.data.text, this.data.mode, this._replyVariant, recentReplies(this.data.mode))
      : null
    if (preset) return Promise.resolve(preset)
    var prompt = Prompt.getPrompt(this.data.mode, false, this.data.text)
    options.clientMeta = { task: 'misread' }
    return this.data.imgs.length
      ? ChatImages.callAI(prompt, message, this.data.imgs, options)
      : API.callAI(prompt, message, null, null, options)
  },

  reviewResult: function(result, issues, options) {
    var self = this
    var source = result.source || self.data.text
    var system = Prompt.getReviewPrompt(self.data.mode, source)
    var message = buildReviewMessage(source, result.replies, issues)
    return API.callAI(system, message, null, null, {
      onRetry: options.onRetry,
      clientMeta: { task: 'misread-review' }
    }).then(function(raw) {
      return normalizeResult(raw, source, self.data.mode)
    })
  },

  finishResult: function(result) {
    var self = this
    if (result && Array.isArray(result.replies)) {
      result.replies.forEach(function(item) {
        if (item && item.text) item.text = Prompt.stripDash(item.text)
      })
    }
    if (result && result.safety_message) result.safety_message = Prompt.stripDash(result.safety_message)
    if (result && result.serious_reply) result.serious_reply = Prompt.stripDash(result.serious_reply)
    var weapons = result.safe ? result.replies.map(function(item) { return item.type }) : []
    var batchId = result.safe ? createBatchId() : ''
    var route = result.safe ? Prompt.getRoute(result.source, self.data.mode) : ''
    if (result.safe) Quality.remember(result.source, self.data.mode, result.replies)
    if (result.safe) Quality.rememberRecent(self.data.mode, result.replies)
    H.addRecord({
      kind: 'misread',
      kindLabel: '已读乱回',
      title: result.safe ? '给「' + (self.data.mode === 'crush' ? 'Crush' : '人') + '」的乱回' : '建议认真回复',
      summary: result.safe ? result.replies[0].text : result.safety_message,
      input: result.source.slice(0, 120),
      imageCount: self.data.imgs.length,
      mode: self.data.mode,
      profileId: self.data.profileId,
      profileName: self.data.profileName,
      result: result
    })
    self.stopLoading()
    self._submitting = false
    self.setData({
      step: result.safe ? 'result' : 'safety',
      res: result,
      submitting: false,
      previousWeapons: weapons,
      batchId: batchId,
      feedbackStates: result.safe ? ['', '', ''] : [],
      feedbackTarget: -1,
      posterPath: '',
      posterReplyIndex: -1,
      posterSaving: false
    })
    if (result.safe) {
      Report.reportServeBatch({
        mode: self.data.mode,
        route: route,
        batchId: batchId,
        promptVersion: FEEDBACK_PROMPT_VERSION,
        source: result.source,
        replies: result.replies
      })
    }
  },

  submit: function() {
    if (this._submitting || !this.data.hasInput) return
    var self = this
    self._submitting = true
    self._replyVariant = nextReplyVariant()
    self.stopPlaceholder()
    self.stopLoading()
    self.setData({
      step: 'loading',
      submitting: true,
      err: '',
      copiedIndex: -1,
      loadingMsg: LOADING_MESSAGES[0]
    })
    var index = 0
    self._loadingTimer = setInterval(function() {
      index = (index + 1) % LOADING_MESSAGES.length
      self.setData({ loadingMsg: LOADING_MESSAGES[index] })
    }, 1200)

    var options = {
      onRetry: function() { self.setData({ loadingMsg: '网络拐了个弯，正在追回来……' }) },
      onStatus: function(message) { self.setData({ loadingMsg: message }) },
      onPrepared: function(imgs) { self.setData({ imgs: imgs }) }
    }
    var message = self.buildMessage()
    var request = self.requestResult(message, options)

    request.then(function(raw) {
      var result = normalizeResult(raw, self.data.text, self.data.mode)
      var recognizedPreset = self.data.imgs.length && !self.data.previousWeapons.length
        ? Prompt.getPreset(result.source, self.data.mode, self._replyVariant, recentReplies(self.data.mode))
        : null
      if (recognizedPreset) result = recognizedPreset
      if (!result.safe) return result
      var oppositeReplies = Quality.getOppositeReplies(result.source, self.data.mode)
      var issues = Quality.inspect(result, self.data.mode, oppositeReplies)
      if (raw && raw.mode && raw.mode !== self.data.mode) issues.unshift('模型返回了错误模式')
      if (!issues.length) return result
      // preset 已是人工校准，直接走原兜底；模型生成结果先交终审重写
      if (recognizedPreset) {
        return fallbackResult(result.source, self.data.mode, self._replyVariant)
      }
      self.setData({ loadingMsg: '正在重读一遍，挑更好的……' })
      return self.reviewResult(result, issues, options).then(function(reviewed) {
        var reviewIssues = Quality.inspect(reviewed, self.data.mode, oppositeReplies)
        if (reviewed.mode && reviewed.mode !== self.data.mode) reviewIssues.unshift('终审返回了错误模式')
        return reviewIssues.length
          ? fallbackResult(reviewed.source || result.source, self.data.mode, self._replyVariant)
          : reviewed
      }).catch(function() {
        return fallbackResult(result.source, self.data.mode, self._replyVariant)
      })
    }).then(function(result) {
      self.finishResult(result)
    }).catch(function() {
      var fallback = fallbackResult(self.data.text, self.data.mode, self._replyVariant)
      self.finishResult(fallback)
    })
  },

  copyReply: function(e) {
    var index = e.currentTarget.dataset.index
    var item = this.data.res && this.data.res.replies && this.data.res.replies[index]
    if (!item) return
    var self = this
    wx.setClipboardData({
      data: item.text,
      success: function() {
        Report.reportCopy({
          mode: self.data.mode,
          route: Prompt.getRoute((self.data.res && self.data.res.source) || self.data.text, self.data.mode),
          source: (self.data.res && self.data.res.source) || self.data.text,
          batchId: self.data.batchId,
          replyId: self.data.batchId ? self.data.batchId + '_' + index : '',
          replyIndex: index,
          promptVersion: FEEDBACK_PROMPT_VERSION,
          weapon: item.type,
          text: item.text
        })
        self.setData({ copiedIndex: index })
        if (self._copyTimer) clearTimeout(self._copyTimer)
        self._copyTimer = setTimeout(function() {
          self.setData({ copiedIndex: -1 })
        }, 1400)
      }
    })
  },

  rateReply: function(e) {
    var index = Number(e.currentTarget.dataset.index)
    var verdict = e.currentTarget.dataset.verdict
    if (index < 0 || index !== Math.floor(index) || !this.data.res || !this.data.res.replies[index]) return
    if (verdict !== 'positive' && verdict !== 'negative') return
    if (this.data.feedbackStates[index]) return
    if (verdict === 'negative') {
      this.setData({ feedbackTarget: index })
      return
    }
    this.submitRating(index, 'positive', 'can_send')
  },

  chooseFeedbackReason: function(e) {
    var index = Number(e.currentTarget.dataset.index)
    var reason = e.currentTarget.dataset.reason
    if (index < 0 || index !== Math.floor(index) || !reason) return
    this.submitRating(index, 'negative', reason)
  },

  submitRating: function(index, verdict, reason) {
    var item = this.data.res && this.data.res.replies && this.data.res.replies[index]
    if (!item || this.data.feedbackStates[index]) return
    var states = this.data.feedbackStates.slice()
    states[index] = verdict
    Report.reportRating({
      mode: this.data.mode,
      route: Prompt.getRoute(this.data.res.source || this.data.text, this.data.mode),
      batchId: this.data.batchId,
      replyId: this.data.batchId + '_' + index,
      replyIndex: index,
      promptVersion: FEEDBACK_PROMPT_VERSION,
      weapon: item.type,
      source: this.data.res.source || this.data.text,
      text: item.text,
      verdict: verdict,
      reason: reason
    })
    this.setData({ feedbackStates: states, feedbackTarget: -1 })
    wx.showToast({ title: '已记下', icon: 'none', duration: 900 })
  },

  renderReplyPoster: function(index) {
    var item = this.data.res && this.data.res.replies && this.data.res.replies[index]
    if (!item) return Promise.reject(new Error('暂无可分享的回复'))
    if (this.data.posterPath && this.data.posterReplyIndex === index) {
      return Promise.resolve(this.data.posterPath)
    }
    if (this._posterPromise) return this._posterPromise

    var self = this
    this._posterPromise = new Promise(function(resolve, reject) {
      wx.createSelectorQuery().in(self).select('#misreadPoster').fields({ node: true, size: true }).exec(function(res) {
        var canvasInfo = res && res[0]
        if (!canvasInfo || !canvasInfo.node || !canvasInfo.width || !canvasInfo.height) {
          reject(new Error('分享图画布加载失败'))
          return
        }
        var canvas = canvasInfo.node
        var ctx = canvas.getContext('2d')
        var dpr = wx.getSystemInfoSync().pixelRatio || 2
        canvas.width = canvasInfo.width * dpr
        canvas.height = canvasInfo.height * dpr
        ctx.scale(dpr, dpr)

        self.drawReplyPoster(ctx, canvasInfo.width, canvasInfo.height, index)
        exportPoster(canvas, canvasInfo.width, canvasInfo.height, dpr, self).then(function(path) {
          self.setData({ posterPath: path, posterReplyIndex: index })
          resolve(path)
        }).catch(reject)
      })
    })
    this._posterPromise.then(function() {
      self._posterPromise = null
    }, function() {
      self._posterPromise = null
    })
    return this._posterPromise
  },

  drawReplyPoster: function(ctx, width, height, index) {
    var item = this.data.res.replies[index]
    var source = this.data.res.source || this.data.text || '聊天截图'
    var modeLabel = this.data.mode === 'crush' ? 'CRUSH MODE' : 'PERSON MODE'

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#F2F3F5'
    ctx.fillRect(0, 0, width, height)

    ctx.strokeStyle = 'rgba(23,25,28,0.07)'
    ctx.lineWidth = 1
    ctx.font = '900 94px sans-serif'
    ctx.strokeText('YIDU', 18, 91)

    ctx.fillStyle = '#17191C'
    ctx.font = '900 10px sans-serif'
    ctx.fillText('YIDU / MISREAD REPLY', 24, 34)
    ctx.fillStyle = '#2D9EE0'
    ctx.fillRect(width - 48, 27, 24, 4)

    ctx.fillStyle = '#8B9198'
    ctx.font = '800 9px sans-serif'
    ctx.fillText('TA SAID', 24, 92)

    roundRect(ctx, 16, 103, width - 32, 90, 18)
    ctx.fillStyle = '#E4E6E9'
    ctx.fill()
    ctx.fillStyle = '#4A4E54'
    drawWrappedPosterText(ctx, source, 34, 127, width - 68, 18, source.length > 80 ? '700 11px sans-serif' : '700 13px sans-serif', 4)

    ctx.fillStyle = '#17191C'
    ctx.font = '900 28px sans-serif'
    ctx.fillText('挑一句，直接发。', 24, 228)
    ctx.fillStyle = '#9AA0A6'
    ctx.font = '700 10px sans-serif'
    ctx.fillText(modeLabel + ' / ' + String(item.type || '阅读失败').toUpperCase(), 24, 250)

    roundRect(ctx, 16, 267, width - 32, 191, 20)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()
    ctx.fillStyle = '#2D9EE0'
    ctx.font = '900 9px sans-serif'
    ctx.fillText(String(item.type || '阅读失败'), 34, 295)
    ctx.fillStyle = '#17191C'
    var replyFont = item.text.length > 88 ? '900 14px sans-serif' : (item.text.length > 55 ? '900 16px sans-serif' : '900 19px sans-serif')
    var replyLineHeight = item.text.length > 88 ? 23 : 27
    drawWrappedPosterText(ctx, item.text, 34, 327, width - 68, replyLineHeight, replyFont, 5)

    ctx.fillStyle = '#A4A9AF'
    drawWrappedPosterText(ctx, '△ ' + (item.warning || '预警：Ta可能会停顿三秒'), 34, 438, width - 68, 14, '700 9px sans-serif', 2)

    ctx.strokeStyle = 'rgba(23,25,28,0.1)'
    ctx.beginPath()
    ctx.moveTo(24, height - 92)
    ctx.lineTo(width - 24, height - 92)
    ctx.stroke()

    ctx.fillStyle = '#17191C'
    ctx.font = '900 11px sans-serif'
    ctx.fillText('微信小程序｜已读 Yidu', 24, height - 42)
    ctx.fillStyle = '#8B9198'
    ctx.font = '700 9px sans-serif'
    ctx.fillText('把聊天发来，帮你读歪', 24, height - 25)

    ctx.fillStyle = '#2D9EE0'
    ctx.font = '900 9px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText('MISREAD REPLY', width - 24, height - 43)
    ctx.fillStyle = '#8B9198'
    ctx.font = '700 8px sans-serif'
    ctx.fillText('YIDU TOOL', width - 24, height - 25)
    ctx.textAlign = 'left'
  },

  saveReplyPoster: function(e) {
    if (this.data.posterSaving) return
    var index = Number(e.currentTarget.dataset.index)
    if (index < 0 || index !== Math.floor(index)) return
    var self = this
    self.setData({ posterSaving: true, posterReplyIndex: index })
    wx.showLoading({ title: '生成分享图中' })
    self.renderReplyPoster(index).then(function(path) {
      return new Promise(function(resolve, reject) {
        wx.saveImageToPhotosAlbum({ filePath: path, success: resolve, fail: reject })
      })
    }).then(function() {
      wx.hideLoading()
      self.setData({ posterSaving: false })
      wx.showToast({ title: '已保存到相册', icon: 'success' })
    }).catch(function(err) {
      wx.hideLoading()
      self.setData({ posterSaving: false })
      if (err && err.errMsg && err.errMsg.indexOf('auth deny') !== -1) {
        wx.showModal({
          title: '需要相册权限',
          content: '开启相册权限后，才能保存分享图。',
          confirmText: '去设置',
          success: function(result) { if (result.confirm) wx.openSetting() }
        })
        return
      }
      wx.showToast({ title: (err && err.message) || '保存失败，请重试', icon: 'none' })
    })
  },

  refresh: function() {
    if (this.data.batchId && this.data.res) {
      Report.reportRefresh({
        mode: this.data.mode,
        route: Prompt.getRoute(this.data.res.source || this.data.text, this.data.mode),
        batchId: this.data.batchId,
        promptVersion: FEEDBACK_PROMPT_VERSION,
        source: this.data.res.source || this.data.text
      })
    }
    this.submit()
  },

  resetInput: function() {
    this._submitting = false
    this.setData({
      step: 'input',
      text: '',
      imgs: [],
      mode: 'person',
      modeHint: '随便乱，后果自负',
      hasInput: false,
      submitting: false,
      err: '',
      res: null,
      copiedIndex: -1,
      batchId: '',
      feedbackStates: [],
      feedbackTarget: -1,
      posterPath: '',
      posterReplyIndex: -1,
      posterSaving: false,
      profileId: '',
      profileName: '',
      profileRelation: '',
      ctx: ''
    })
    this.startPlaceholder()
  },

  goSeriousReply: function() {
    var source = this.data.res && this.data.res.source || this.data.text
    var task = '对方发来：' + source + '。这条消息可能是真心求助，请生成一条真诚、稳定、不说教的认真回复。'
    var params = [
      'mode=reply',
      'replyTask=' + encodeURIComponent(task),
      this.data.profileId ? 'profileId=' + encodeURIComponent(this.data.profileId) : '',
      this.data.profileName ? 'profileName=' + encodeURIComponent(this.data.profileName) : '',
      this.data.ctx ? 'ctx=' + encodeURIComponent(this.data.ctx) : ''
    ].filter(Boolean).join('&')
    wx.navigateTo({ url: '/pages/check/check?' + params })
  },

  onShareAppMessage: function() {
    var source = this.data.res && this.data.res.source
    Report.reportShare({
      mode: this.data.mode,
      batchId: this.data.batchId,
      promptVersion: FEEDBACK_PROMPT_VERSION,
      source: source
    })
    var share = Share.misread(source)
    if (this.data.posterPath) share.imageUrl = this.data.posterPath
    return share
  }
})

function exportPoster(canvas, width, height, dpr, page) {
  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      wx.canvasToTempFilePath({
        canvas: canvas,
        fileType: 'png',
        quality: 1,
        destWidth: Math.round(width * dpr),
        destHeight: Math.round(height * dpr),
        success: function(result) { resolve(result.tempFilePath) },
        fail: function() { reject(new Error('分享图生成失败')) }
      }, page)
    }, 50)
  })
}

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

function drawWrappedPosterText(ctx, text, x, y, maxWidth, lineHeight, font, maxLines) {
  ctx.font = font
  var chars = String(text || '').split('')
  var lines = []
  var line = ''
  for (var i = 0; i < chars.length; i++) {
    if (chars[i] === '\n') {
      if (line) lines.push(line)
      line = ''
      if (lines.length >= maxLines) break
      continue
    }
    var test = line + chars[i]
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = chars[i]
      if (lines.length >= maxLines) break
    } else {
      line = test
    }
  }
  if (line && lines.length < maxLines) lines.push(line)
  var consumed = lines.join('').length
  if (consumed < chars.length && lines.length) {
    var last = lines.length - 1
    while (ctx.measureText(lines[last] + '…').width > maxWidth && lines[last]) {
      lines[last] = lines[last].slice(0, -1)
    }
    lines[last] += '…'
  }
  lines.forEach(function(item, index) {
    ctx.fillText(item, x, y + index * lineHeight)
  })
}
