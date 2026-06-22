import { useEffect, useState } from 'react'

function App() {
  const [apiStatus, setApiStatus] = useState('checking...')

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/health`)
      .then(res => res.json())
      .then(data => setApiStatus(data.status))
      .catch(() => setApiStatus('disconnected'))
  }, [])

  return (
    <div className="min-h-screen bg-canvas text-ink font-sans px-8 py-24">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-serif text-4xl tracking-tight mb-2">DataMind</h1>
        <p className="text-muted mb-8">Excel/CSV analysis with AI-generated insights.</p>
        <div className="border border-border rounded-lg p-6 bg-white">
          <span className="text-sm text-muted">Backend status</span>
          <p className="font-mono text-sm mt-1">{apiStatus}</p>
        </div>
      </div>
    </div>
  )
}

export default App