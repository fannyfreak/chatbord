import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

// Google スプレッドシートID
const SPREADSHEET_ID = '16cD8WO3FSox84dEvRCqOwiF2MaeQjZDOaYHQCXjx8a0'

// ElevenLabs設定
const ELEVENLABS_API_KEY = 'sk_de8fd5e0f643d5520c5a7ed138b8f15b6c5db8711c6f181f'
const ELEVENLABS_VOICE_ID = '21m00Tcm4TlvDq8ikWAM' // Rachel - 無料で使えるデフォルト声

// スプレッドシートからデータを取得
const fetchSheetData = async () => {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json`

  try {
    const res = await fetch(url)
    const text = await res.text()

    const jsonMatch = text.match(/google\.visualization\.Query\.setResponse\(([\s\S]*)\);?$/)
    if (!jsonMatch) {
      throw new Error('Failed to parse sheet data')
    }

    const data = JSON.parse(jsonMatch[1])
    const cols = data.table.cols
    const rows = data.table.rows

    if (!rows || rows.length === 0) return []

    // 列ラベルを取得（colsから、なければ1行目から）
    let headers = cols.map(col => col.label || '')
    let dataRows = rows

    // colsにラベルがない場合、1行目をヘッダーとして使用
    if (headers.every(h => !h) && rows.length > 0 && rows[0].c) {
      headers = rows[0].c.map(cell => cell ? (cell.v || '') : '')
      dataRows = rows.slice(1)
    }

    console.log('Headers:', headers)

    const records = dataRows.map(row => {
      const record = {}
      if (row.c) {
        row.c.forEach((cell, idx) => {
          const header = headers[idx]
          if (header) {
            record[header] = cell ? (cell.v || '') : ''
          }
        })
      }
      return record
    }).filter(r => r['来客者名'])

    console.log('Records found:', records.length)

    return records
  } catch (error) {
    console.error('Error fetching sheet:', error)
    return []
  }
}

// 予約照会エンドポイント
app.get('/api/reservation', async (req, res) => {
  const { name } = req.query

  console.log('Search request for:', name)

  if (!name) {
    return res.status(400).json({ error: 'name is required' })
  }

  try {
    const records = await fetchSheetData()
    console.log('All records:', JSON.stringify(records, null, 2))

    const found = records.find(r => {
      console.log('Checking:', r['来客者名'], 'against:', name)
      return r['来客者名'] && r['来客者名'].includes(name)
    })

    if (found) {
      res.json({
        found: true,
        visitorName: found['来客者名'] || '',
        company: found['会社'] || '',
        staff: found['担当者'] || '',
        department: found['部門'] || '',
        phone: found['電話'] || '',
        note: found['備考'] || '',
      })
    } else {
      res.json({ found: false })
    }
  } catch (error) {
    console.error('Reservation lookup error:', error)
    res.status(500).json({ error: 'Failed to lookup reservation' })
  }
})

// ElevenLabs TTS エンドポイント
app.post('/api/tts', async (req, res) => {
  const { text } = req.body

  if (!text) {
    return res.status(400).json({ error: 'text is required' })
  }

  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.text()
      console.error('ElevenLabs error:', error)
      return res.status(500).json({ error: 'TTS generation failed' })
    }

    // 音声データをそのまま返す
    res.set('Content-Type', 'audio/mpeg')
    const audioBuffer = await response.arrayBuffer()
    res.send(Buffer.from(audioBuffer))

  } catch (error) {
    console.error('TTS error:', error)
    res.status(500).json({ error: 'TTS generation failed' })
  }
})

// ヘルスチェック
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
