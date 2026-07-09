var DAY_MS = 24 * 60 * 60 * 1000
var WEEK_DAYS = 7
var MONTH_DAYS = 30

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

var WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function startOfDay(ts) {
  var d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function dateKey(ts) {
  var d = new Date(ts)
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()
}

function dayLabel(ts, todayStart) {
  var diff = Math.round((todayStart - startOfDay(ts)) / DAY_MS)
  if (diff === 0) return '今天'
  if (diff === 1) return '昨天'
  return WEEK_LABELS[new Date(ts).getDay()]
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
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

function scoreRecord(record) {
  var score = 0
  if (record.kind === 'diagnose') score += 7
  else if (record.kind === 'translate') score += 5
  else if (record.kind === 'reply') score += 4
  else if (record.kind === 'check') score += 3
  else if (record.kind === 'misread') score += 2
  else if (record.kind === 'predict') score -= 2

  var feedback = record.feedback || {}
  if (feedback.action === 'sent') score += 3
  if (feedback.action === 'skipped') score += 2
  if (feedback.action === 'thinking') score -= 1
  if (feedback.response === 'replied') score += 16
  if (feedback.response === 'silent') score -= 16
  if (feedback.response === 'cold') score -= 11
  return score
}

function scoreDay(records) {
  if (!records.length) return null
  var score = 48
  records.forEach(function(record) {
    score += scoreRecord(record)
  })
  if (records.length >= 3) score -= 4
  return clamp(Math.round(score), 0, 100)
}

function buildDayBuckets(records, dayCount, now) {
  var todayStart = startOfDay(now)
  var byKey = {}
  records.forEach(function(record) {
    if (!record.createdAt) return
    var key = dateKey(record.createdAt)
    byKey[key] = byKey[key] || []
    byKey[key].push(record)
  })

  var days = []
  for (var i = dayCount - 1; i >= 0; i--) {
    var ts = todayStart - i * DAY_MS
    var key = dateKey(ts)
    var dayRecords = byKey[key] || []
    days.push({
      key: key,
      ts: ts,
      label: dayLabel(ts, todayStart),
      shortLabel: i === 0 ? '今' : WEEK_LABELS[new Date(ts).getDay()].replace('周', ''),
      count: dayRecords.length,
      records: dayRecords,
      score: scoreDay(dayRecords)
    })
  }
  return days
}

function buildTemperature(days) {
  var chartHeight = 140
  var chartWidth = 560
  var points = days.map(function(day, index) {
    var x = days.length === 1 ? 50 : 4 + index * (92 / (days.length - 1))
    var score = day.score === null ? 0 : day.score
    var y = day.score === null ? chartHeight : Math.round(chartHeight - score / 100 * 116 - 12)
    return {
      key: day.key,
      label: day.shortLabel,
      score: day.score,
      scoreText: day.score === null ? '--' : String(day.score),
      hasRecord: day.score !== null,
      left: Math.round(x * 10) / 10,
      top: y
    }
  })
  var lines = []
  for (var i = 0; i < points.length - 1; i++) {
    var a = points[i]
    var b = points[i + 1]
    if (!a.hasRecord || !b.hasRecord) continue
    var dxPercent = b.left - a.left
    var dx = dxPercent / 100 * chartWidth
    var dy = b.top - a.top
    lines.push({
      key: a.key + '-' + b.key,
      left: a.left,
      top: a.top,
      width: Math.round(Math.sqrt(dx * dx + dy * dy) / chartWidth * 1000) / 10,
      angle: Math.round(Math.atan2(dy, dx) * 180 / Math.PI)
    })
  }
  return { points: points, lines: lines }
}

function buildRecentDays(days) {
  return days.filter(function(day) {
    return day.count > 0
  }).slice().reverse().slice(0, 3).map(function(day) {
    var first = day.records[0] || {}
    return {
      key: day.key,
      label: day.label,
      count: day.count,
      score: day.score,
      title: first.title || first.summary || '记录了一次互动',
      meta: day.count + ' 条记录｜温度 ' + (day.score === null ? '--' : day.score)
    }
  })
}

function buildStreak(days) {
  var todayIndex = days.length - 1
  var includesToday = !!(days[todayIndex] && days[todayIndex].count > 0)
  var index = includesToday ? todayIndex : todayIndex - 1
  var count = 0
  for (var i = index; i >= 0; i--) {
    if (!days[i] || !days[i].count) break
    count += 1
  }
  var text = count
    ? (includesToday ? '已连续记录 ' + count + ' 天' : '已连续记录 ' + count + ' 天，今天补一条继续')
    : '还没形成连续记录'
  return {
    count: count,
    includesToday: includesToday,
    text: text
  }
}

function buildMilestone(recordedDays, streak, ready) {
  if (ready) {
    return {
      label: '7/7',
      title: '七日周报已生成',
      copy: '这段关系已经有一周趋势，可以看升温、降温还是反复拉扯。'
    }
  }
  if (recordedDays >= 5) {
    return {
      label: '5/7',
      title: '趋势开始成型',
      copy: '已经能看出关系温度的方向，再补两天就能生成完整周报。'
    }
  }
  if (recordedDays >= 3) {
    return {
      label: '3/7',
      title: '已经看出一点苗头',
      copy: '互动样本开始连续了，可以初步观察谁在推进、谁在降温。'
    }
  }
  if (streak.includesToday) {
    return {
      label: '1/7',
      title: '今天已记录',
      copy: '明天回来再记一条，就能开始对比关系温度。'
    }
  }
  return {
    label: '0/7',
    title: '今天先记一条',
    copy: '不用写很多，一句话或一张截图就能让趋势开始有数据。'
  }
}

function buildTodayRecap(today) {
  if (!today || !today.count) {
    return {
      label: '今日复盘',
      title: '今天还没记录',
      copy: '补一条后，这里会给出当天关系温度和明天建议。',
      scoreText: '未记录',
      tone: 'empty'
    }
  }

  var actionCounts = countBy(today.records, function(item) {
    return item.feedback && item.feedback.action
  })
  var responseCounts = countBy(today.records, function(item) {
    return item.feedback && item.feedback.response
  })
  var score = today.score || 0
  var title = '今天信号平稳'
  var copy = '今天有记录，但还不够下结论。明天再补一条，看曲线往哪边走。'
  var tone = 'neutral'

  if (score >= 68) {
    title = '今天有升温信号'
    copy = '有真实回应或有效互动。明天可以轻推进，但别一次性交底。'
    tone = 'warm'
  } else if (score < 42) {
    title = '今天消耗偏高'
    copy = '先别追问。明天重点看 Ta 会不会主动补一句，而不是你继续加码。'
    tone = 'cold'
  } else if (score < 52) {
    title = '今天偏拉扯'
    copy = '信号不算稳，适合少解释、多观察，把主动性留给对方一点。'
    tone = 'cool'
  }

  if ((responseCounts.silent || 0) + (responseCounts.cold || 0) > 0) {
    title = score < 52 ? title : '今天回应偏弱'
    copy = '对方回应质量一般。先别急着二连，明天看 Ta 会不会主动补回应。'
    tone = score < 42 ? 'cold' : 'cool'
  } else if ((responseCounts.replied || 0) > 0 && (responseCounts.replied || 0) >= (responseCounts.silent || 0) + (responseCounts.cold || 0)) {
    title = '今天回应可看'
    copy = '有回应是好事，但先观察稳定性。明天继续看 Ta 会不会主动延续话题。'
    tone = 'warm'
  } else if ((actionCounts.skipped || 0) > (actionCounts.sent || 0)) {
    title = '今天克制住了'
    copy = '没发不等于没进展。明天可以把想发的话先过一遍，再决定。'
    tone = 'neutral'
  }

  return {
    label: '今日复盘',
    title: title,
    copy: copy,
    scoreText: score + '/100',
    tone: tone
  }
}

function buildInsight(reportSeed) {
  var temperature = reportSeed.latestScore === null ? '采样中' : reportSeed.latestScore + '/100'
  var initiative = '继续观察'
  var cost = '轻度消耗'
  if (reportSeed.replied > reportSeed.weak && reportSeed.replied > 0) initiative = '回应可看'
  else if (reportSeed.weak > reportSeed.replied && reportSeed.weak > 0) initiative = '回应偏弱'
  else if (reportSeed.sent > 0) initiative = '已开始推进'
  if (reportSeed.weak >= 2 || reportSeed.thinking >= 2) cost = '消耗偏高'
  else if (reportSeed.skipped > reportSeed.sent) cost = '克制较多'
  return [
    { label: '关系温度', value: temperature },
    { label: 'Ta 主动性', value: initiative },
    { label: '你的消耗', value: cost }
  ]
}

function build(profile, records) {
  var now = Date.now()
  records = records || []
  var weekStart = startOfDay(now) - (WEEK_DAYS - 1) * DAY_MS
  var monthStart = startOfDay(now) - (MONTH_DAYS - 1) * DAY_MS
  var weekRecords = records.filter(function(item) {
    return item.createdAt && item.createdAt >= weekStart
  })
  var monthRecords = records.filter(function(item) {
    return item.createdAt && item.createdAt >= monthStart
  })
  var weekDays = buildDayBuckets(weekRecords, WEEK_DAYS, now)
  var monthDays = buildDayBuckets(monthRecords, MONTH_DAYS, now)
  var recordedWeekDays = weekDays.filter(function(day) { return day.count > 0 }).length
  var recordedMonthDays = monthDays.filter(function(day) { return day.count > 0 }).length
  var needed = Math.max(0, WEEK_DAYS - recordedWeekDays)
  var ready = !needed
  var streak = buildStreak(weekDays)
  var milestone = buildMilestone(recordedWeekDays, streak, ready)
  var todayRecap = buildTodayRecap(weekDays[weekDays.length - 1])
  var progress = Math.min(100, Math.round(recordedWeekDays / WEEK_DAYS * 100))
  var monthProgress = Math.min(100, Math.round(recordedMonthDays / MONTH_DAYS * 100))
  var kindCounts = countBy(weekRecords, function(item) { return item.kind })
  var actionCounts = countBy(weekRecords, function(item) { return item.feedback && item.feedback.action })
  var responseCounts = countBy(weekRecords, function(item) { return item.feedback && item.feedback.response })
  var mainKind = dominant(kindCounts)
  var sent = actionCounts.sent || 0
  var skipped = actionCounts.skipped || 0
  var thinking = actionCounts.thinking || 0
  var replied = responseCounts.replied || 0
  var weak = (responseCounts.silent || 0) + (responseCounts.cold || 0)
  var temperature = buildTemperature(weekDays)
  var scoredDays = weekDays.filter(function(day) { return day.score !== null })
  var latestScore = scoredDays.length ? scoredDays[scoredDays.length - 1].score : null
  var firstScore = scoredDays.length ? scoredDays[0].score : null
  var maxScore = scoredDays.length ? Math.max.apply(null, scoredDays.map(function(day) { return day.score })) : null
  var minScore = scoredDays.length ? Math.min.apply(null, scoredDays.map(function(day) { return day.score })) : null
  var delta = latestScore === null || firstScore === null ? 0 : latestScore - firstScore
  var volatility = maxScore === null || minScore === null ? 0 : maxScore - minScore
  var status = '关系趋势采样中'
  var verdict = '已记录 ' + recordedWeekDays + '/7 天，再记录 ' + needed + ' 天生成七日关系周报。'
  var trend = '每天记一次和 ' + profile.name + ' 的真实互动，才能看清这段关系是在升温、降温，还是反复拉扯。'
  var advice = '今天先补一条聊天截图、Ta 的原话，或你想发出去的一句话。'
  var focus = '记录今天的互动'

  if (ready) {
    if (volatility >= 28) {
      status = '忽冷忽热'
      verdict = '本周趋势：反复拉扯'
      trend = '这周关系温度波动明显，说明互动里既有推进，也有让你消耗的回落。'
      focus = '少追问，看主动性'
    } else if (delta >= 12) {
      status = '正在升温'
      verdict = '本周趋势：关系升温'
      trend = '这周关系温度整体向上，可以轻推进，但不要一次性交底。'
      focus = '轻推进'
    } else if (delta <= -12) {
      status = '明显降温'
      verdict = '本周趋势：关系降温'
      trend = '这周关系温度往下走，先减少解释和追问，观察 Ta 会不会主动补回应。'
      focus = '先降频'
    } else {
      status = '稳定观察'
      verdict = '本周趋势：稳定观察'
      trend = '这周没有明显升降，关系还在观察区。重点不是猜，而是继续看具体动作。'
      focus = '继续记录'
    }

    if (sent && weak >= sent) {
      advice = '下周少追加解释，优先观察 Ta 有没有主动补回应。'
    } else if (skipped > sent) {
      advice = '下周可以把想发的话先过一遍风险，别只靠忍。'
    } else if (replied > weak && replied > 0) {
      advice = '可以轻推进，每次只推进一小步，别一次性交底。'
    } else if (thinking >= 2) {
      advice = '下周把问题落到具体一句话上，少脑补，多记录。'
    } else {
      advice = '下周继续记录 Ta 的真实动作，不要只记录自己的情绪波动。'
    }
  }

  return {
    ready: ready,
    total: recordedWeekDays,
    target: WEEK_DAYS,
    needed: needed,
    streak: streak.count,
    streakIncludesToday: streak.includesToday,
    streakText: streak.text,
    milestone: milestone,
    todayRecap: todayRecap,
    progress: progress,
    monthTotal: recordedMonthDays,
    monthTarget: MONTH_DAYS,
    monthProgress: monthProgress,
    recordTotal: weekRecords.length,
    status: status,
    verdict: verdict,
    trend: trend,
    advice: advice,
    focus: focus,
    latestScore: latestScore,
    latestScoreText: latestScore === null ? '采样中' : latestScore + '/100',
    firstScore: firstScore,
    delta: delta,
    mainKind: mainKind ? labelKind(mainKind) : '暂无',
    sent: sent,
    skipped: skipped,
    thinking: thinking,
    replied: replied,
    weak: weak,
    temperaturePoints: temperature.points,
    temperatureLines: temperature.lines,
    recentDays: buildRecentDays(weekDays),
    insight: buildInsight({
      latestScore: latestScore,
      replied: replied,
      weak: weak,
      sent: sent,
      skipped: skipped,
      thinking: thinking
    }),
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
