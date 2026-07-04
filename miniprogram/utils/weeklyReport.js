var WEEK_MS = 7 * 24 * 60 * 60 * 1000
var TARGET = 3

var KIND_LABELS = {
  translate: '潜台词',
  check: '发不发',
  reply: '回复',
  diagnose: '截图',
  predict: '预测',
  misread: '乱回'
}

var ACTION_LABELS = {
  sent: '已发',
  skipped: '没发',
  thinking: '观望'
}

var RESPONSE_LABELS = {
  replied: '回了',
  silent: '没回',
  cold: '很冷'
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
  return KIND_LABELS[kind] || '记录'
}

function toBreakdown(counts, labels) {
  return Object.keys(labels).map(function(key) {
    return {
      key: key,
      label: labels[key],
      count: counts[key] || 0
    }
  }).filter(function(item) {
    return item.count > 0
  })
}

function buildEvidence(records) {
  return records.slice(0, 5).map(function(item, index) {
    return {
      id: item.id,
      no: index < 9 ? '0' + (index + 1) : '' + (index + 1),
      label: item.kindLabel || labelKind(item.kind),
      title: item.title || '一条关系记录',
      summary: item.summary || item.input || '暂无摘要',
      timeText: item.timeText || ''
    }
  })
}

function dominant(counts) {
  return Object.keys(counts).sort(function(a, b) {
    return counts[b] - counts[a]
  })[0] || ''
}

function build(profile, records) {
  var now = Date.now()
  var weekRecords = (records || []).filter(function(item) {
    return item.createdAt && now - item.createdAt <= WEEK_MS
  })
  var total = weekRecords.length
  var needed = Math.max(0, TARGET - total)
  var progress = Math.min(100, Math.round(total / TARGET * 100))
  var kindCounts = countBy(weekRecords, function(item) { return item.kind })
  var actionCounts = countBy(weekRecords, function(item) { return item.feedback && item.feedback.action })
  var responseCounts = countBy(weekRecords, function(item) { return item.feedback && item.feedback.response })
  var mainKind = dominant(kindCounts)
  var sent = actionCounts.sent || 0
  var skipped = actionCounts.skipped || 0
  var thinking = actionCounts.thinking || 0
  var replied = responseCounts.replied || 0
  var weak = (responseCounts.silent || 0) + (responseCounts.cold || 0)
  var status = '采样中'
  var verdict = '再记录 ' + needed + ' 次，就能生成第一份七日关系报告。'
  var trend = '先补足材料，别急着给 ' + profile.name + ' 定性。'
  var advice = '建议先完成一次潜台词翻译或发不发检测，让档案有可比较的记录。'
  var focus = '先收集材料'

  if (!needed) {
    if ((kindCounts.check || 0) + (kindCounts.reply || 0) >= 2) {
      status = '行动决策期'
      trend = '这周重点不是看懂 Ta，而是你在反复决定要不要行动。'
      focus = '发之前先降温'
    } else if ((kindCounts.translate || 0) >= 2) {
      status = '信号解读期'
      trend = '你这周主要在拆 Ta 的话，说明关系还停在猜测和确认阶段。'
      focus = '少猜一句，多看一个动作'
    } else if ((kindCounts.diagnose || 0) + (kindCounts.predict || 0) >= 2) {
      status = '关系复盘期'
      trend = '你已经开始看整体模式，不只是盯着某一句话。'
      focus = '看模式，不看单点情绪'
    } else {
      status = '轻量观察期'
      trend = '记录开始形成连续性，但还需要更多具体互动来判断走向。'
      focus = '继续补样本'
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
    target: TARGET,
    needed: needed,
    progress: progress,
    status: status,
    verdict: verdict,
    trend: trend,
    advice: advice,
    focus: focus,
    mainKind: mainKind ? labelKind(mainKind) : '暂无',
    sent: sent,
    skipped: skipped,
    thinking: thinking,
    replied: replied,
    weak: weak,
    kindBreakdown: toBreakdown(kindCounts, KIND_LABELS),
    actionBreakdown: toBreakdown(actionCounts, ACTION_LABELS),
    responseBreakdown: toBreakdown(responseCounts, RESPONSE_LABELS),
    evidence: buildEvidence(weekRecords)
  }
}

module.exports = {
  build: build,
  labelKind: labelKind
}
