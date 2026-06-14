var Prompt = require('./misreadPrompt')

var CACHE_KEY = 'yidu_misread_mode_cache_v1'

function compact(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。！？、；：“”‘’（）《》【】,.!?;:'"()[\]{}<>~`·…—_-]/g, '')
}

function shingles(value) {
  var text = compact(value)
  var set = {}
  if (text.length < 2) {
    if (text) set[text] = true
    return set
  }
  for (var i = 0; i < text.length - 1; i++) set[text.slice(i, i + 2)] = true
  return set
}

function similarity(a, b) {
  var left = shingles(a)
  var right = shingles(b)
  var union = {}
  var intersection = 0
  Object.keys(left).forEach(function(key) { union[key] = true })
  Object.keys(right).forEach(function(key) {
    if (left[key]) intersection += 1
    union[key] = true
  })
  var total = Object.keys(union).length
  return total ? intersection / total : 0
}

function sharedBigrams(a, b) {
  var left = shingles(a)
  var right = shingles(b)
  return Object.keys(left).filter(function(key) { return right[key] }).length
}

function containsAny(text, words) {
  text = String(text || '')
  return words.some(function(word) { return text.indexOf(word) !== -1 })
}

function addIssue(issues, issue) {
  if (issues.indexOf(issue) === -1) issues.push(issue)
}

function hasReplyType(replies, pattern) {
  return replies.some(function(item) {
    return pattern.test(String(item && item.type || ''))
  })
}

function isChickenText(text) {
  return /(世界上所有的惊喜和好运|当你学会了装傻|让别人羡慕太容易了|生活不会一直为难你|慢慢来，很多事情|人这一生最重要的|每一次沉默|真正的成长不是|有些路看起来很远)/.test(String(text || ''))
}

function inspect(result, mode, oppositeReplies) {
  if (!result || result.safe === false) return []
  var replies = result.replies || []
  var source = String(result.source || '')
  var route = Prompt.getRoute(source, mode)
  var issues = []
  var types = {}
  var texts = []
  var genericMarkers = [
    '哈哈', '开玩笑', '狗头', 'yyds', '听君一席话',
    '综上', '这说明', '建议你',
    '作为一个', '根据你的描述', '从这个角度', '换句话说',
    '脑电波', '思念指数', '情感指数', '免疫屏障', '辐射服',
    '强度指数', '想你程序', '诊断手册', '情感手册',
    '启动程序', '程序启动', '物理意义', '心理学术语',
    '已读乱回版', '人生里了', '把命也重开', '建议重开',
    '约空气', '过期辣酱', '辣酱的审核',
    '殡仪馆', '哭丧', '哭灵', '棺材'
  ]
  var familyAndRiskMarkers = [
    '想你妈', '你妈', '你爸', '你爹', '你娘',
    '改成你家', '你家楼下', '实时定位', '跟踪你'
  ]
  var directInsults = [
    '废物', '脑残', '智障', '丑死', '穷鬼', '没人要',
    '你不配', '你有病', '神经病', '垃圾人'
  ]
  var warningExplanationMarkers = [
    '制造', '反差', '甜藏', '暗藏', '实则', '语气',
    '把抽象', '转成具体', '炸点', '创作', '阅读失败'
  ]

  if (replies.length !== 3) addIssue(issues, '候选不是三条')

  replies.forEach(function(item, index) {
    var type = compact(item.type)
    var text = String(item.text || '').trim()
    if (!text) addIssue(issues, '第' + (index + 1) + '条为空')
    if (type && types[type] && route !== 'flat') addIssue(issues, '三条使用了重复武器')
    types[type] = true
    if (containsAny(text.toLowerCase(), genericMarkers)) {
      addIssue(issues, '出现 AI 腔、陈旧梗或破功标记')
    }
    var aiStructureHits = ['首先', '其次', '最后'].filter(function(marker) {
      return text.indexOf(marker) !== -1
    }).length
    if (aiStructureHits >= 2) addIssue(issues, '出现定义式 AI 三段结构')
    if (containsAny(text, familyAndRiskMarkers)) {
      addIssue(issues, '攻击家人或使用越界行动')
    }
    if (containsAny(text, directInsults)) {
      addIssue(issues, '只有泛骂，没有针对行为的轻微冒犯')
    }
    if (containsAny(item.warning, warningExplanationMarkers)) {
      addIssue(issues, '预警在解释创作手法')
    }
    if (/(\d{1,3}\s*%|百分之\d+|好感度|心动值|喜欢值|魅力值)/i.test(text)) {
      addIssue(issues, '用数字量化感情')
    }
    texts.push(text)

    var typeName = String(item.type || '')
    if (/无关细节/.test(typeName) && /(我上次|后来|结果|顺便|满墙|炸了)/.test(text)) {
      addIssue(issues, '无关细节追问夹带了虚构经历')
    }
    if (/(一字魔改|形近字魔改)/.test(typeName) && /→|已读乱回版|建议/.test(text)) {
      addIssue(issues, '魔改后又解释或加戏')
    }
    if (/(一字魔改|形近字魔改)/.test(typeName) &&
        String(result.source || '').length > 2 &&
        text.length > String(result.source || '').length * 3) {
      addIssue(issues, '魔改篇幅过长，已经另搭舞台')
    }
    if (/冷安慰/.test(typeName) && /(通常|因为|所以|治疗方案|建议你)/.test(text)) {
      addIssue(issues, '冷安慰在解释逻辑')
    }
    if (/特质再就业/.test(typeName) && /(一辈子|愿意被你|永远|但我愿意)/.test(text)) {
      addIssue(issues, '特质再就业后补了空头情话')
    }
    if (/特质再就业/.test(typeName) &&
        !/(太认真|容易认真|想太多|嘴硬|记仇|疑心|敏感|逐字|脑补|健忘|记性)/.test(source)) {
      addIssue(issues, '原话没有具体特质，却强套特质再就业')
    }
    if (/鸡汤/.test(typeName) && sharedBigrams(text, source) > 0) {
      addIssue(issues, '鸡汤根据原话进行了改装')
    }
    if (/户口本/.test(text) && /户口本[。！？!?]?\s*[^。！？!?]/.test(text)) {
      addIssue(issues, '行动式认领在炸点后继续解释')
    }
  })

  for (var i = 0; i < texts.length; i++) {
    for (var j = i + 1; j < texts.length; j++) {
      if (compact(texts[i]) === compact(texts[j]) || similarity(texts[i], texts[j]) >= 0.52) {
        addIssue(issues, '三条候选过于相似')
      }
    }
  }
  if (texts.filter(isChickenText).length > 1) addIssue(issues, '同一批出现了多条同质鸡汤')

  if (mode === 'crush') {
    var crushBanned = [
      '过敏原', '季节性过敏', '去医院看了', '医生说', '你别来找我',
      '离我远点', '排行榜', '排名更新', '预约名额', '可用时段'
    ]
    texts.forEach(function(text) {
      if (containsAny(text, crushBanned)) addIssue(issues, 'Crush 回答串入了 person 模式')
      if (/(一辈子|愿意被你|永远喜欢|永远爱|但我愿意)/.test(text)) {
        addIssue(issues, 'Crush 回答出现空头情话')
      }
    })
    if (/(哪个女|哪个男|跟谁|约会去了|为什么不理|怎么不回|不回我|是不是不想理|去哪了)/.test(source)) {
      texts.forEach(function(text) {
        if (!/^(没有|没|不是|不在|没跟|没有跟|刚才没有)/.test(text.trim())) {
          addIssue(issues, 'Crush 不安题没有先直接给安全答案')
        }
        if (/(倒是你|你是不是|是不是偷偷|反将一军|查岗|约空气)/.test(text)) {
          addIssue(issues, 'Crush 不安题在反问或倒打一耙')
        }
      })
    }
  } else {
    var personBanned = [
      '民政局', '户口本', '我想你', '我喜欢你', '想见你',
      '周六出来', '约会', '我们俩结婚', '跟我回家'
    ]
    texts.forEach(function(text) {
      if (containsAny(text, personBanned)) addIssue(issues, 'person 回答串入了 Crush 模式')
    })
  }

  var luxuryMarkers = [
    '迪拜', '路易威登', 'LV', '直升机', '24K', '劳斯莱斯',
    '私人飞机', '游艇', '爱马仕', '百达翡丽'
  ]
  if (route === 'reference_confession') {
    var materialReply = texts.some(function(text) {
      var materialHits = [
        '工作日', '三甲医院', '无犯罪记录', '征信',
        '学信网', '社保', '婚姻登记', 'PDF'
      ].filter(function(marker) { return text.indexOf(marker) !== -1 }).length
      return text.length >= 90 && materialHits >= 5
    })
    if (!materialReply) addIssue(issues, '表白题没有生成完整的材料补交通知')
  }
  if (route === 'sympathy_literal') {
    if (!texts.some(function(text) {
      return /(疼痛位置|持续时间|放射到|心内科|心电图)/.test(text)
    })) {
      addIssue(issues, '心疼题没有误读成真实问诊')
    }
    texts.forEach(function(text) {
      if (/(纸巾|心疼牛|殡仪馆|哭丧)/.test(text)) addIssue(issues, '心疼题使用了低级谐音或越界意象')
    })
  }
  if (route === 'quote_flip') {
    if (!texts.some(function(text) {
      return /更多时间难过/.test(text) && /我这边难过完了/.test(text)
    })) {
      addIssue(issues, '劝快乐题没有完成“继续难过”的交接反转')
    }
  }
  if (route === 'control_manual') {
    if (!texts.some(function(text) {
      return /(长按|按住)/.test(text) && /(指示灯|配对|电源键)/.test(text)
    })) {
      addIssue(issues, '控制题没有误读成真实设备说明书')
    }
  }
  if (route === 'crush_joke') {
    if (!texts.some(function(text) {
      return /(证据|举证|原图|聊天记录|材料)/.test(text) &&
        /(我喜欢你|本人喜欢你|我对你)/.test(text)
    })) {
      addIssue(issues, 'Crush 调侃题没有正确举证“我喜欢你”')
    }
    texts.forEach(function(text) {
      if (/(我也喜欢|^(对|是|嗯|没错)[，。！! ]*(我也)?喜欢|周[六日]|几点见|地铁站|火锅|餐厅|见面|请客|出来吃|户口本)/.test(text)) {
        addIssue(issues, 'Crush 调侃题擅自进入告白或约会')
      }
    })
  }
  if (route === 'crush_true_test') {
    if (!texts.some(function(text) {
      return /(闹钟|备注|创建时间|三个月前|日历|备忘录)/.test(text)
    })) {
      addIssue(issues, 'Crush 真情试探缺少已有行动证据')
    }
    texts.forEach(function(text) {
      if (/(你家|打车|7-11|便利店|现在去|马上到|发定位|几点见)/.test(text)) {
        addIssue(issues, 'Crush 真情试探临时编了地点或行程')
      }
    })
  }
  if (route === 'crush_insecurity') {
    if (hasReplyType(replies, /鸡汤/) || texts.some(isChickenText)) {
      addIssue(issues, 'Crush 不安题不应使用无关鸡汤')
    }
    texts.forEach(function(text) {
      if (/[？?]/.test(text)) addIssue(issues, 'Crush 不安题不应反问')
    })
  }
  if (route === 'live_line') {
    if (!texts.some(function(text) {
      return /不挑的都脱单/.test(text) && /你挑成这样|你这么挑|挑得/.test(text)
    })) {
      addIssue(issues, '活线题没有沿着“不挑”逻辑推回两人')
    }
  }
  if (route === 'crush_marriage') {
    if (!texts.some(function(text) {
      return /回家.*户口本/.test(text)
    })) {
      addIssue(issues, 'Crush 结婚题没有命中低调行动式认领')
    }
    texts.forEach(function(text) {
      if (/(今晚\s*7点|今晚七点|穿白衬衫|结昏)/.test(text)) {
        addIssue(issues, 'Crush 结婚题过度表演或使用低级魔改')
      }
    })
  }
  if (route === 'crush_confession') {
    if (!texts.some(function(text) {
      return /申请已受理/.test(text) && /本人到场/.test(text)
    })) {
      addIssue(issues, 'Crush 告白题没有明确接住并保持阅读失败')
    }
    texts.forEach(function(text) {
      if (/(三甲医院|无犯罪记录|银行征信|学信网|传染八项)/.test(text)) {
        addIssue(issues, 'Crush 告白题串入了 person 材料审查')
      }
    })
  }
  if (route === 'boast') {
    texts.forEach(function(text) {
      if (containsAny(text, luxuryMarkers)) addIssue(issues, '吹牛题硬塞了奢侈品')
    })
    if (!texts.some(function(text) {
      return /(第二是谁|排名|第[一二三]|《.+》|故事会|第\d+期)/.test(text)
    })) {
      addIssue(issues, '吹牛题没有命中排名或假出处')
    }
  }
  if (route === 'daily_incident') {
    var hasManual = texts.some(function(text) {
      return /(做法|步骤|锅中|倒入|加入|翻炒|使用方法|注意事项)/.test(text) && text.length >= 45
    })
    var hasChicken = hasReplyType(replies, /鸡汤/)
    if (!hasManual || !hasChicken) addIssue(issues, '日常小事没有完整说明书和原版鸡汤')
  }
  if (route === 'flat') {
    texts.forEach(function(text) {
      if (containsAny(text, luxuryMarkers)) addIssue(issues, '零把手题硬塞了暴发户式奢侈品')
    })
    if (!hasReplyType(replies, /鸡汤/)) {
      addIssue(issues, '零把手题缺少完整无关鸡汤')
    }
    if (!hasReplyType(replies, /通知/) || !hasReplyType(replies, /凡尔赛/)) {
      addIssue(issues, '零把手题的三条回答仍然同质化')
    }
  }

  ;(oppositeReplies || []).forEach(function(oldText) {
    texts.forEach(function(text) {
      if (similarity(text, oldText) >= 0.42) addIssue(issues, '与另一模式的历史回答过于相似')
    })
  })

  return issues
}

function sourceKey(source) {
  var key = compact(source)
  return key && key !== '聊天截图' ? key.slice(0, 120) : ''
}

function readCache() {
  try {
    var cache = wx.getStorageSync(CACHE_KEY)
    return Array.isArray(cache) ? cache : []
  } catch (e) {
    return []
  }
}

function getOppositeReplies(source, mode) {
  var key = sourceKey(source)
  if (!key) return []
  var opposite = mode === 'crush' ? 'person' : 'crush'
  var matched = readCache().filter(function(item) {
    return item && item.sourceKey === key && item.mode === opposite
  })
  return matched.length ? matched[0].replies || [] : []
}

function remember(source, mode, replies) {
  var key = sourceKey(source)
  if (!key) return
  var cache = readCache().filter(function(item) {
    return !(item && item.sourceKey === key && item.mode === mode)
  })
  cache.unshift({
    sourceKey: key,
    mode: mode,
    replies: (replies || []).map(function(item) { return item.text || item }).slice(0, 3),
    createdAt: Date.now()
  })
  try { wx.setStorageSync(CACHE_KEY, cache.slice(0, 16)) } catch (e) {}
}

module.exports = {
  inspect: inspect,
  similarity: similarity,
  getOppositeReplies: getOppositeReplies,
  remember: remember
}
