function textOf(res, fallback) {
  if (!res) return fallback
  if (typeof res === 'string') return res
  return res.text || fallback
}

function clampPercent(n, fallback) {
  var v = Number(n)
  if (isNaN(v)) return fallback
  if (v < 0) return 0
  if (v > 100) return 100
  return Math.round(v)
}

function safeArray(v, fallback) {
  return Array.isArray(v) && v.length ? v : fallback
}

function normalizeSignals(signals) {
  return safeArray(signals, [
    { msg: '本次返回缺少原话信号', who: '系统', meaning: '可以补充更多上下文或截图重试', icon: '⚠️' }
  ]).map(function(item) {
    item = item || {}
    return {
      msg: item.msg || '未提取到原话',
      who: item.who || '系统',
      meaning: item.meaning || '这条信号需要更多上下文判断',
      icon: item.icon || '🔎'
    }
  })
}

function normalizePossibilities(list, text) {
  return safeArray(list, [
    { label: 'A', percent: 60, meaning: text, reason: 'AI 未返回标准结构，这是兜底解读' },
    { label: 'B', percent: 25, meaning: '上下文不足', reason: '单句话容易误判真实意图' },
    { label: 'C', percent: 15, meaning: '需要继续观察', reason: '看后续行动比看一句话更准' }
  ]).map(function(item, idx) {
    item = item || {}
    return {
      label: item.label || ['A','B','C'][idx] || 'A',
      percent: clampPercent(item.percent, idx === 0 ? 60 : 20),
      meaning: item.meaning || text,
      reason: item.reason || '缺少详细原因'
    }
  })
}

function normalizePredictions(list) {
  return safeArray(list, [
    { time: '1周后', scene: '互动会继续围绕当前矛盾拉扯', prob: 60, emoji: '🌀' },
    { time: '1个月后', scene: '如果没人主动改变沟通方式，关系会变得更累', prob: 55, emoji: '⚠️' },
    { time: '3个月后', scene: '走向取决于你们是否能稳定表达需求', prob: 50, emoji: '🔭' }
  ]).map(function(item, idx) {
    item = item || {}
    return {
      time: item.time || ['1周后','1个月后','3个月后'][idx] || '之后',
      scene: item.scene || '关系走向还需要更多互动判断',
      prob: clampPercent(item.prob, 50),
      emoji: item.emoji || '🔭'
    }
  })
}

function normalizeDiagnose(res) {
  res = res || {}
  var t = textOf(res, 'AI 已完成分析，但这次返回得有点不按格式。建议换一段更完整的聊天记录再试。')
  return {
    user_type: res.user_type || 'secure',
    user_label: res.user_label || '待判断',
    partner_type: res.partner_type || 'secure',
    partner_label: res.partner_label || '待判断',
    confidence: clampPercent(res.confidence, 60),
    match: res.match || t,
    signals: normalizeSignals(res.signals),
    user_advice: res.user_advice || '先别急着用结论审判自己。把聊天记录补完整，再看模式会更准。',
    partner_advice: res.partner_advice || '先按对方当前行为回应，不要替 Ta 脑补完整人格。'
  }
}

function normalizeTranslate(res, input) {
  res = res || {}
  var t = textOf(res, '这句话信息量不够，可能需要更多上下文。')
  return {
    translations: safeArray(res.translations, [{
      original: input || 'Ta说的话',
      verdict: t,
      possibilities: normalizePossibilities(null, t),
      most_likely: 'A',
      why: '本次结果来自兜底解析'
    }]).map(function(item) {
      item = item || {}
      var verdict = item.verdict || t
      return {
        original: item.original || input || 'Ta说的话',
        verdict: verdict,
        possibilities: normalizePossibilities(item.possibilities, verdict),
        most_likely: item.most_likely || 'A',
        why: item.why || '缺少详细解释'
      }
    })
  }
}

function normalizeCheck(res) {
  res = res || {}
  var t = textOf(res, '可以先别急着发，等情绪降下来再看一遍。')
  return {
    verdict: res.verdict || (res.danger === false ? '可以发' : '先别发'),
    danger: typeof res.danger === 'boolean' ? res.danger : true,
    trigger: res.trigger || '对方的防御或压力',
    prediction: res.prediction || 'Ta 可能不会按你期待的方式回应',
    alternative: res.alternative || '我想确认一下你的想法，方便的时候回我就好。',
    reason: res.reason || t,
    type_note: res.type_note || ''
  }
}

function normalizeReplyDrafts(list) {
  return safeArray(list, [
    { label: '稳一点', text: '我想把这件事说清楚，但不想用情绪逼你。你方便的时候，我们认真聊一下。', why: '不追问、不控诉，但把需求放到桌面上。' },
    { label: '直一点', text: '我在意的是你的态度，不是你每次都必须立刻回复。你可以慢，但别让我一直猜。', why: '把真实需求说出来，减少试探。' },
    { label: '收手版', text: '我先不继续追这个话题了。等你也愿意认真聊的时候再说。', why: '停止消耗，把主动权拿回来。' }
  ]).slice(0, 3).map(function(item, idx) {
    item = item || {}
    return {
      label: item.label || ['稳一点','直一点','收手版'][idx] || '版本',
      text: item.text || '我想先冷静一下，等我们都能好好说话的时候再聊。',
      why: item.why || '这版会比情绪化输出更稳。'
    }
  })
}

function normalizeReply(res) {
  res = res || {}
  var t = textOf(res, '先别用长篇大论赌对方会突然变清醒。短一点，稳一点。')
  return {
    strategy: res.strategy || t,
    drafts: normalizeReplyDrafts(res.drafts),
    avoid: res.avoid || '别发小作文、别连环追问、别用反话测试对方。',
    note: res.note || ''
  }
}

function normalizePredict(res) {
  res = res || {}
  var t = textOf(res, 'AI 已完成预测，但这次返回结构不完整。')
  return {
    stage: res.stage || '关系观察期',
    stage_desc: res.stage_desc || t,
    predictions: normalizePredictions(res.predictions),
    turning: res.turning || '下一次冲突后的处理方式',
    best: res.best || '能把话说清楚，减少猜测和试探。',
    worst: res.worst || '继续靠脑补和冷处理互相消耗。',
    todo: res.todo || '先做一件事：把你真正想要的回应说清楚。'
  }
}

module.exports = {
  normalizeDiagnose: normalizeDiagnose,
  normalizeTranslate: normalizeTranslate,
  normalizeCheck: normalizeCheck,
  normalizeReply: normalizeReply,
  normalizePredict: normalizePredict
}
