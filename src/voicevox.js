// VOICEVOX API ユーティリティ
// VOICEVOXを起動すると localhost:50021 でAPIサーバーが立ち上がる

const VOICEVOX_BASE_URL = 'http://localhost:50021'

// スピーカー（声）のID
// VOICEVOXを起動して http://localhost:50021/speakers で一覧取得可能
export const SPEAKERS = {
  zundamon_normal: 3,        // ずんだもん（ノーマル）
  zundamon_sexy: 5,          // ずんだもん（セクシー）
  metan_normal: 2,           // 四国めたん（ノーマル）
  metan_sexy: 4,             // 四国めたん（セクシー）
  tsumugi: 8,                // 春日部つむぎ
  ritsu: 9,                  // 波音リツ
  himari: 14,                // 冥鳴ひまり
  no7: 29,                   // No.7
  ryusei: 13,                // 青山龍星
  goki: 27,                  // 後鬼（人間ver.）
}

// デフォルトのスピーカー（後で変更可能）
let currentSpeaker = SPEAKERS.himari

export const setCurrentSpeaker = (speakerId) => {
  currentSpeaker = speakerId
}

export const getCurrentSpeaker = () => currentSpeaker

// VOICEVOXが起動しているかチェック
export const checkVoicevoxRunning = async () => {
  try {
    const res = await fetch(`${VOICEVOX_BASE_URL}/version`)
    if (res.ok) {
      const version = await res.text()
      console.log(`VOICEVOX version: ${version}`)
      return true
    }
    return false
  } catch (e) {
    console.warn('VOICEVOX is not running')
    return false
  }
}

// テキストから音声を生成して再生
export const speak = async (text, speakerId = currentSpeaker) => {
  try {
    // 1. 音声合成用のクエリを作成
    const queryRes = await fetch(
      `${VOICEVOX_BASE_URL}/audio_query?text=${encodeURIComponent(text)}&speaker=${speakerId}`,
      { method: 'POST' }
    )

    if (!queryRes.ok) {
      throw new Error('Failed to create audio query')
    }

    const query = await queryRes.json()

    // 2. 音声を合成
    const synthesisRes = await fetch(
      `${VOICEVOX_BASE_URL}/synthesis?speaker=${speakerId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query),
      }
    )

    if (!synthesisRes.ok) {
      throw new Error('Failed to synthesize audio')
    }

    // 3. 音声データをBlobとして取得
    const audioBlob = await synthesisRes.blob()
    const audioUrl = URL.createObjectURL(audioBlob)

    // 4. 再生
    return new Promise((resolve, reject) => {
      const audio = new Audio(audioUrl)
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl)
        resolve()
      }
      audio.onerror = (e) => {
        URL.revokeObjectURL(audioUrl)
        reject(e)
      }
      audio.play()
    })

  } catch (error) {
    console.error('VOICEVOX speak error:', error)
    // フォールバック: Web Speech API
    return speakFallback(text)
  }
}

// フォールバック用（VOICEVOXが動いてない時）
const speakFallback = (text) => {
  return new Promise((resolve) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'ja-JP'
      utterance.rate = 1.0
      utterance.onend = resolve
      utterance.onerror = resolve
      speechSynthesis.speak(utterance)
    } else {
      resolve()
    }
  })
}

// 利用可能なスピーカー一覧を取得
export const getSpeakers = async () => {
  try {
    const res = await fetch(`${VOICEVOX_BASE_URL}/speakers`)
    if (res.ok) {
      return await res.json()
    }
    return []
  } catch (e) {
    console.error('Failed to get speakers:', e)
    return []
  }
}
