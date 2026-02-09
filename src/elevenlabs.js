// ElevenLabs TTS ユーティリティ

const API_BASE_URL = 'http://localhost:3001'

// ElevenLabsで音声を生成して再生
export const speak = async (text) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    })

    if (!response.ok) {
      throw new Error('TTS request failed')
    }

    // 音声データを取得
    const audioBlob = await response.blob()
    const audioUrl = URL.createObjectURL(audioBlob)

    // 再生
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
    console.error('ElevenLabs speak error:', error)
    // フォールバック: Web Speech API
    return speakFallback(text)
  }
}

// フォールバック用（ElevenLabsがエラーの時）
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

// ElevenLabsが使えるかチェック（バックエンド経由）
export const checkElevenLabsReady = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/health`)
    return res.ok
  } catch (e) {
    return false
  }
}
