function str(value) {
  return String(value == null ? '' : value).trim()
}

function clampText(value, max) {
  value = str(value).replace(/\s+/g, ' ')
  return value.length > max ? value.slice(0, max - 1) + '…' : value
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

function drawWrapped(ctx, text, x, y, maxWidth, lineHeight, font, maxLines) {
  text = str(text)
  ctx.font = font
  var line = ''
  var lines = []
  for (var i = 0; i < text.length; i++) {
    var next = line + text[i]
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line)
      line = text[i]
      if (lines.length >= maxLines) break
    } else {
      line = next
    }
  }
  if (lines.length < maxLines && line) lines.push(line)
  lines.slice(0, maxLines).forEach(function(item, index) {
    if (index === maxLines - 1 && item.length < text.length && text.indexOf(item) !== text.length - item.length) {
      item = item.slice(0, Math.max(0, item.length - 1)) + '…'
    }
    ctx.fillText(item, x, y + index * lineHeight)
  })
  return y + lines.slice(0, maxLines).length * lineHeight
}

function drawCard(ctx, x, y, width, section, accent) {
  var body = clampText(section.body || '', section.max || 120)
  var title = clampText(section.title || '', 34)
  var label = clampText(section.label || 'RESULT', 28)
  var dark = !!section.dark
  var height = section.height || (body.length > 70 ? 142 : 118)

  roundRect(ctx, x, y, width, height, 16)
  ctx.fillStyle = dark ? '#2D2F33' : '#FFFFFF'
  ctx.fill()

  ctx.fillStyle = accent
  ctx.font = '900 9px sans-serif'
  ctx.fillText(label.toUpperCase(), x + 18, y + 26)

  ctx.fillStyle = dark ? '#FFFFFF' : '#17191C'
  ctx.font = '900 17px sans-serif'
  drawWrapped(ctx, title, x + 18, y + 53, width - 36, 22, '900 17px sans-serif', 2)

  ctx.fillStyle = dark ? 'rgba(255,255,255,0.74)' : '#6B7280'
  drawWrapped(ctx, body, x + 18, y + 88, width - 36, 17, '700 11px sans-serif', 3)
  return y + height + 12
}

function drawPoster(ctx, width, height, data) {
  var accent = data.accent || '#10A8E8'
  var title = clampText(data.title || '已读结果', 42)
  var subtitle = clampText(data.subtitle || '结果已生成', 70)
  var kicker = clampText(data.kicker || 'YIDU RESULT', 30)
  var sections = (data.sections || []).slice(0, 4)

  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#F2F3F5'
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = 'rgba(23,25,28,0.07)'
  ctx.lineWidth = 1
  ctx.font = '900 94px sans-serif'
  ctx.strokeText('YIDU', 18, 91)

  ctx.fillStyle = '#17191C'
  ctx.font = '900 10px sans-serif'
  ctx.fillText('YIDU / ' + kicker.toUpperCase(), 24, 34)
  ctx.fillStyle = accent
  ctx.fillRect(width - 48, 27, 24, 4)

  ctx.fillStyle = '#17191C'
  var titleEnd = drawWrapped(ctx, title, 24, 126, width - 48, 34, '900 31px sans-serif', 2)
  ctx.fillStyle = '#8B9198'
  drawWrapped(ctx, subtitle, 24, titleEnd + 14, width - 48, 17, '700 12px sans-serif', 2)

  var y = 226
  sections.forEach(function(section, index) {
    y = drawCard(ctx, 16, y, width - 32, section, index === 0 ? accent : '#C18A00')
  })

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
  ctx.fillText(data.footer || '把聊天发来，少猜一点', 24, height - 25)
  ctx.fillStyle = accent
  ctx.font = '900 9px sans-serif'
  ctx.textAlign = 'right'
  ctx.fillText('RESULT SNAPSHOT', width - 24, height - 43)
  ctx.fillStyle = '#8B9198'
  ctx.font = '700 8px sans-serif'
  ctx.fillText('YIDU TOOL', width - 24, height - 25)
  ctx.textAlign = 'left'
}

function render(page, selector, data) {
  return new Promise(function(resolve, reject) {
    wx.createSelectorQuery().in(page).select(selector).fields({ node: true, size: true }).exec(function(res) {
      var info = res && res[0]
      if (!info || !info.node || !info.width || !info.height) {
        reject(new Error('结果图画布加载失败'))
        return
      }
      var canvas = info.node
      var ctx = canvas.getContext('2d')
      var dpr = wx.getSystemInfoSync().pixelRatio || 2
      canvas.width = info.width * dpr
      canvas.height = info.height * dpr
      ctx.scale(dpr, dpr)
      drawPoster(ctx, info.width, info.height, data || {})
      setTimeout(function() {
        wx.canvasToTempFilePath({
          canvas: canvas,
          fileType: 'png',
          quality: 1,
          destWidth: Math.round(info.width * dpr),
          destHeight: Math.round(info.height * dpr),
          success: function(result) { resolve(result.tempFilePath) },
          fail: function() { reject(new Error('结果图生成失败')) }
        }, page)
      }, 50)
    })
  })
}

function save(path) {
  return new Promise(function(resolve, reject) {
    wx.saveImageToPhotosAlbum({ filePath: path, success: resolve, fail: reject })
  })
}

function handleSaveError(err) {
  if (err && err.errMsg && err.errMsg.indexOf('auth deny') !== -1) {
    wx.showModal({
      title: '需要相册权限',
      content: '开启相册权限后，才能保存结果图。',
      confirmText: '去设置',
      success: function(result) { if (result.confirm) wx.openSetting() }
    })
    return
  }
  wx.showToast({ title: (err && err.message) || '保存失败，请重试', icon: 'none' })
}

module.exports = {
  render: render,
  save: save,
  handleSaveError: handleSaveError
}
