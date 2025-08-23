import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createSSEDecoder } from './lib/sse.js'

const DEFAULT_MODEL = 'gemini-2.5-flash'

function useProxyUrl() {
  const envUrl = import.meta.env.VITE_GEMINI_PROXY_URL
  return envUrl && envUrl.trim().length > 0 ? envUrl.trim() : ''
}

export default function App() {
  const proxyUrl = useProxyUrl()
  const [model, setModel] = useState(DEFAULT_MODEL)
  const [system, setSystem] = useState('')
  const [temperature, setTemperature] = useState(1.0)
  const [topP, setTopP] = useState('')
  const [topK, setTopK] = useState('')
  const [maxOutputTokens, setMaxOutputTokens] = useState('')
  const [responseMimeType, setResponseMimeType] = useState('')
  const [thinkingBudget, setThinkingBudget] = useState('') // set 0 to disable thinking for 2.5 Flash
  const [prompt, setPrompt] = useState('')
  const [stream, setStream] = useState(true)

  const [messages, setMessages] = useState([]) // {role:'user'|'model', text:string}

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('gemini-history')
      if (saved) {
        setMessages(JSON.parse(saved))
      }
    } catch (e) {
      console.error('Failed to load history', e)
    }
  }, [])

  useEffect(() => {
    if (messages.length) {
      window.localStorage.setItem('gemini-history', JSON.stringify(messages))
    } else {
      window.localStorage.removeItem('gemini-history')
    }
  }, [messages])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef(null)

  const canSend = useMemo(() => {
    return !busy && prompt.trim().length > 0 && (proxyUrl || window.location.pathname.startsWith('/api'))
  }, [busy, prompt, proxyUrl])

  async function handleSend(e) {
    e?.preventDefault()
    setError('')

    const userMsg = { role: 'user', text: prompt }
    setMessages((prev) => [...prev, userMsg])
    setPrompt('')

    if (stream) {
      await sendStream(userMsg.text)
    } else {
      await sendOnce(userMsg.text)
    }
  }

  function buildConfigBody(bodyPrompt, useHistory) {
    const cfg = {}
    if (system) cfg.system = system
    if (temperature !== '') cfg.temperature = parseFloat(temperature)
    if (topP !== '') cfg.topP = parseFloat(topP)
    if (topK !== '') cfg.topK = parseInt(topK, 10)
    if (maxOutputTokens !== '') cfg.maxOutputTokens = parseInt(maxOutputTokens, 10)
    if (responseMimeType) cfg.responseMimeType = responseMimeType
    if (thinkingBudget !== '') cfg.thinkingBudget = parseFloat(thinkingBudget)

    const body = {
      prompt: bodyPrompt,
      model,
      ...cfg,
      stream: stream
    }

    if (useHistory) {
      // Server expects: [{ role, parts:[{text}] }]
      body.history = messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.text }]
      }))
    }

    return body
  }

  async function sendOnce(bodyPrompt) {
    setBusy(true)
    try {
      const res = await fetch(proxyUrl || '/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(buildConfigBody(bodyPrompt, true))
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || `HTTP ${res.status}`)
      }

      const json = await res.json()
      const modelText = json.text ?? ''
      const usage = json.usage || json.usageMetadata
      setMessages((prev) => [...prev, { role: 'model', text: modelText, usage }])
    } catch (e) {
      setError(e.message || String(e))
    } finally {
      setBusy(false)
    }
  }

  async function sendStream(bodyPrompt) {
    setBusy(true)

    // NOTE: Your backend stream path uses POST + SSE over fetch; EventSource cannot POST.
    // We'll parse the ReadableStream manually.
    const controller = new AbortController()
    abortRef.current = controller

    // Seed an empty assistant message that we'll progressively fill.
    setMessages((prev) => [...prev, { role: 'model', text: '' }])
    let acc = ''

    try {
      const res = await fetch(proxyUrl || '/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream'
        },
        body: JSON.stringify(buildConfigBody(bodyPrompt, /*useHistory=*/false)),
        signal: controller.signal
      })

      if (!res.ok || !res.body) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.error || `HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      const onEvent = (event, payload) => {
        if (event === 'done') return
        const chunkText = payload?.text || ''
        if (!chunkText) return
        acc += chunkText
        setMessages((prev) => {
          const copy = [...prev]
          copy[copy.length - 1] = { ...copy[copy.length - 1], text: acc }
          return copy
        })
      }
      const feed = createSSEDecoder(onEvent)

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        feed(decoder.decode(value, { stream: true }))
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        setError(e.message || String(e))
      }
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  function handleStop() {
    abortRef.current?.abort()
  }

  function handleClear() {
    setMessages([])
    setError('')
  }

  return (
    <div className="container">
      <header>
        <h1>Gemini Proxy Playground</h1>
        <div className="status">
          {proxyUrl
            ? <span className="ok">Proxy: {proxyUrl}</span>
            : <span className="warn">VITE_GEMINI_PROXY_URL 미설정 — (선택) Firebase Hosting rewrite로 /api/gemini 사용 가능</span>
          }
        </div>
      </header>

      <section className="controls">
        <div className="field">
          <label>Model</label>
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder={DEFAULT_MODEL} />
        </div>

        <div className="field">
          <label>System</label>
          <input value={system} onChange={(e) => setSystem(e.target.value)} placeholder="시스템 프롬프트(옵션)" />
        </div>

        <div className="grid">
          <div className="field">
            <label>Temperature</label>
            <input type="number" step="0.1" min="0" max="2" value={temperature} onChange={(e) => setTemperature(e.target.value)} />
          </div>
          <div className="field">
            <label>topP</label>
            <input type="number" step="0.05" min="0" max="1" value={topP} onChange={(e) => setTopP(e.target.value)} placeholder="(선택)" />
          </div>
          <div className="field">
            <label>topK</label>
            <input type="number" step="1" min="1" value={topK} onChange={(e) => setTopK(e.target.value)} placeholder="(선택)" />
          </div>
          <div className="field">
            <label>maxOutputTokens</label>
            <input type="number" step="1" min="1" value={maxOutputTokens} onChange={(e) => setMaxOutputTokens(e.target.value)} placeholder="(선택)" />
          </div>
          <div className="field">
            <label>responseMimeType</label>
            <input value={responseMimeType} onChange={(e) => setResponseMimeType(e.target.value)} placeholder="예) application/json" />
          </div>
          <div className="field">
            <label>thinkingBudget</label>
            <input type="number" step="0.1" min="0" value={thinkingBudget} onChange={(e) => setThinkingBudget(e.target.value)} placeholder="2.5 Flash에서 0 입력 시 비활성" />
          </div>
          <div className="field">
            <label>Streaming</label>
            <input type="checkbox" checked={stream} onChange={(e) => setStream(e.target.checked)} />
          </div>
        </div>
      </section>

      <section className="chat">
        <div className="messages">
          {messages.map((m, idx) => (
            <div key={idx} className={`msg ${m.role}`}>
              <div className="bubble">
                {m.text}
              </div>
              {m.usage && (
                <div className="usage">
                  <small>usage: {JSON.stringify(m.usage)}</small>
                </div>
              )}
            </div>
          ))}
        </div>

        <form className="composer" onSubmit={handleSend}>
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="프롬프트를 입력하세요…"
          />
          <div className="actions">
            <button type="submit" disabled={!canSend}>
              {busy ? '전송 중…' : '전송'}
            </button>
            <button type="button" onClick={handleStop} disabled={!busy}>
              중지
            </button>
            <button type="button" onClick={handleClear} disabled={busy}>
              초기화
            </button>
          </div>
          {stream && (
            <p className="note">스트리밍 모드는 서버 구현상 history를 보내지 않습니다.</p>
          )}
        </form>
        {error && <div className="error">⚠️ {error}</div>}
      </section>

    </div>
  )
}
