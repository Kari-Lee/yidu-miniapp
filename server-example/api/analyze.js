/**
 * 后端中转示例 - 部署到 Vercel / 任意 Node 服务器
 * 
 * 小程序不能直接调千问API（域名白名单限制），
 * 所以需要这个中间层：小程序 → 你的服务器 → 千问API
 * 
 * Vercel 部署：把这个文件放到 api/analyze.js
 * 
 * 环境变量：
 *   QIANWEN_API_KEY=你的千问API密钥
 */

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { system, message } = req.body

  try {
    const response = await fetch(
      'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.QIANWEN_API_KEY}`
        },
        body: JSON.stringify({
          model: 'qwen-plus',  // 或 qwen-turbo / qwen-max
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: message }
          ],
          response_format: { type: 'json_object' }
        })
      }
    )

    const data = await response.json()

    if (data.choices && data.choices[0]) {
      const content = data.choices[0].message.content
      // 尝试解析 JSON
      try {
        const parsed = JSON.parse(content)
        return res.status(200).json(parsed)
      } catch {
        return res.status(200).json({ raw: content })
      }
    }

    return res.status(500).json({ error: '千问返回异常' })
  } catch (err) {
    console.error('API Error:', err)
    return res.status(500).json({ error: '服务暂时不可用' })
  }
}
