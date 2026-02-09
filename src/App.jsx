import { useState, useEffect, useRef } from 'react'
import './App.css'
import { speak, checkVoicevoxRunning, SPEAKERS, setCurrentSpeaker } from './voicevox'

const API_BASE_URL = 'http://localhost:3001'

// クリップ定義（動画パスを追加）
const CLIPS = {
  idle: { name: '待機', color: '#3a506b', video: null },
  greeting: { name: '挨拶', color: '#90be6d', video: '/clips/call.mp4' },
  explaining: { name: '説明', color: '#5bc0be', video: '/clips/call.mp4' },
  agreeing: { name: '承知', color: '#4CAF50', video: '/clips/call.mp4' },
  delivery: { name: '配送対応', color: '#f4a261', video: '/clips/delivery.mp4' },
  thinking: { name: '検索中', color: '#6fffe9', video: null },
  warning: { name: '注意', color: '#ff6b6b', video: null },
}

function App() {
  const [currentClip, setCurrentClip] = useState('idle')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [ttsReady, setTtsReady] = useState(false)
  const [hasStarted, setHasStarted] = useState(false)
  const videoRef = useRef(null)

  // シナリオ状態
  const [screen, setScreen] = useState('menu')
  const [message, setMessage] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [resultData, setResultData] = useState(null)

  // 起動時にVOICEVOX確認
  useEffect(() => {
    const checkTts = async () => {
      const isRunning = await checkVoicevoxRunning()
      setTtsReady(isRunning)
      if (isRunning) {
        setCurrentSpeaker(SPEAKERS.goki) // 後鬼（人間ver.）
      }
    }
    checkTts()
  }, [])

  // クリップ変更時に動画再生
  useEffect(() => {
    if (videoRef.current && CLIPS[currentClip]?.video) {
      videoRef.current.play().catch(e => console.log('Video play error:', e))
    }
  }, [currentClip])

  // 音声読み上げ
  const speakText = async (text) => {
    const cleanText = text.replace(/📞|[\n]/g, ' ')
    setIsSpeaking(true)
    try {
      await speak(cleanText)
    } catch (e) {
      console.error('Speech error:', e)
    }
    setIsSpeaking(false)
  }

  // 開始
  const handleStart = () => {
    setHasStarted(true)
    setScreen('menu')
    setMessage('いらっしゃいませ。ご用件をお選びください。')
    setCurrentClip('greeting')
    speakText('いらっしゃいませ。ご用件をお選びください。')
  }

  // メニュー選択
  const handleMenuChoice = (choice) => {
    if (isSpeaking) return

    switch (choice) {
      case 'reservation':
        setScreen('input')
        setMessage('お名前をお聞かせください。')
        setCurrentClip('explaining')
        speakText('お名前をお聞かせください。')
        break
      case 'delivery':
        setScreen('result')
        setMessage('担当が参りますので、少々お待ちください。')
        setCurrentClip('delivery')
        setResultData({ type: 'staff' })
        speakText('担当が参りますので、少々お待ちください。')
        break
      case 'inquiry':
      case 'other':
        setScreen('result')
        setMessage('恐れ入りますが、下記の番号にお電話ください。\n\n📞 03-1234-5678')
        setCurrentClip('explaining')
        setResultData({ type: 'call' })
        speakText('恐れ入りますが、下記の番号にお電話ください。')
        break
    }
  }

  // 名前検索
  const handleNameSearch = async () => {
    if (!inputValue.trim() || isLoading) return

    setIsLoading(true)
    setCurrentClip('thinking')
    setMessage('お調べしております...')

    try {
      const res = await fetch(`${API_BASE_URL}/api/reservation?name=${encodeURIComponent(inputValue.trim())}`)
      const data = await res.json()

      if (data.found) {
        const msg = `${data.visitorName}様ですね。\n${data.department}の${data.staff}が参りますので、少々お待ちください。`
        setScreen('result')
        setMessage(msg)
        setCurrentClip('agreeing')
        setResultData({ type: 'found', ...data })
        speakText(`${data.visitorName}様ですね。${data.department}の${data.staff}が参りますので、少々お待ちください。`)
      } else {
        const msg = '申し訳ございません。ご予約が見つかりませんでした。\n\n恐れ入りますが、下記の番号にお電話ください。\n\n📞 03-1234-5678'
        setScreen('result')
        setMessage(msg)
        setCurrentClip('warning')
        setResultData({ type: 'not_found' })
        speakText('申し訳ございません。ご予約が見つかりませんでした。恐れ入りますが、お電話にてお問い合わせください。')
      }
    } catch (error) {
      console.error('Search error:', error)
      setScreen('result')
      setMessage('システムエラーが発生しました。\n\n恐れ入りますが、下記の番号にお電話ください。\n\n📞 03-1234-5678')
      setCurrentClip('warning')
      setResultData({ type: 'error' })
      speakText('システムエラーが発生しました。恐れ入りますが、お電話にてお問い合わせください。')
    } finally {
      setIsLoading(false)
    }
  }

  // 最初に戻る
  const handleReset = () => {
    setScreen('menu')
    setMessage('いらっしゃいませ。ご用件をお選びください。')
    setCurrentClip('greeting')
    setInputValue('')
    setResultData(null)
    speakText('いらっしゃいませ。ご用件をお選びください。')
  }

  const currentVideo = CLIPS[currentClip]?.video

  // 開始前の画面
  if (!hasStarted) {
    return (
      <div className="app">
        <div className="start-screen">
          <div className="character-wrapper">
            <div
              className="character-display"
              style={{ backgroundColor: CLIPS.idle.color }}
            >
              <video
                src="/clips/call_intro.mp4"
                loop
                muted
                autoPlay
                playsInline
                className="character-video"
              />
            </div>
          </div>
          <button className="start-button" onClick={handleStart}>
            タップして開始
          </button>
          <div className="status-bar">
            <span className={`status-item ${ttsReady ? 'ready' : 'not-ready'}`}>
              音声: {ttsReady ? 'VOICEVOX' : 'Web Speech'}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      {/* キャラクター表示エリア */}
      <div className="character-area">
        <div className={`character-wrapper ${isSpeaking ? 'speaking' : ''}`}>
          <div
            className="character-display"
            style={{ backgroundColor: CLIPS[currentClip]?.color || CLIPS.idle.color }}
          >
            {currentVideo ? (
              <video
                ref={videoRef}
                src={currentVideo}
                loop
                muted
                playsInline
                className="character-video"
              />
            ) : (
              <div className="clip-placeholder">
                <p className="clip-label">{CLIPS[currentClip]?.name || '待機'}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* メッセージ表示 */}
      <div className="message-display">
        <p className="message-text">{message}</p>
      </div>

      {/* 画面ごとの表示 */}
      <div className="choices-area">
        {screen === 'menu' && (
          <>
            <button className="choice-button" onClick={() => handleMenuChoice('reservation')} disabled={isSpeaking}>
              ご予約の方
            </button>
            <button className="choice-button" onClick={() => handleMenuChoice('delivery')} disabled={isSpeaking}>
              お届け物
            </button>
            <button className="choice-button" onClick={() => handleMenuChoice('inquiry')} disabled={isSpeaking}>
              ご相談・お問い合わせ
            </button>
            <button className="choice-button" onClick={() => handleMenuChoice('other')} disabled={isSpeaking}>
              その他
            </button>
          </>
        )}

        {screen === 'input' && (
          <>
            <div className="input-area">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleNameSearch()}
                placeholder="お名前を入力"
                disabled={isLoading}
                autoFocus
              />
              <button onClick={handleNameSearch} disabled={isLoading || !inputValue.trim()}>
                検索
              </button>
            </div>
            <button className="choice-button secondary" onClick={handleReset} disabled={isLoading}>
              戻る
            </button>
          </>
        )}

        {screen === 'result' && (
          <button className="choice-button" onClick={handleReset} disabled={isSpeaking}>
            最初に戻る
          </button>
        )}
      </div>
    </div>
  )
}

export default App
