import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const VERDE = '#255736'
const TEAL = '#2d7d6f'
const PASSWORD = 'Millefonti47!'

const RUOLI = [
  { label: '🗂 Segreteria', path: '/segreteria' },
  { label: '💉 Infermeria', path: '/infermeria' },
  { label: '🩺 Studio 1',   path: '/studio/1' },
  { label: '🩺 Studio 2',   path: '/studio/2' },
  { label: '🩺 Studio 3',   path: '/studio/3' },
]

export default function Login() {
  const [pwd, setPwd] = useState('')
  const [autenticato, setAutenticato] = useState(false)
  const [errore, setErrore] = useState(false)
  const navigate = useNavigate()

  const verifica = () => {
    if (pwd === PASSWORD) {
      setAutenticato(true)
      setErrore(false)
    } else {
      setErrore(true)
    }
  }

  if (!autenticato) return (
    <div style={{
      minHeight: '100vh',
      background: '#f0f5f0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif'
    }}>
      <img src="/logo_transparent.png" alt="Ambulatorio Millefonti"
        style={{ height: 160, objectFit: 'contain', marginBottom: 32 }} />
      <div style={{
        background: 'white',
        borderRadius: 20,
        padding: 40,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        minWidth: 320,
        textAlign: 'center'
      }}>
        <div style={{ color: VERDE, fontSize: 20, fontWeight: 700, marginBottom: 24 }}>
          Accesso riservato
        </div>
        <input
          type="password"
          value={pwd}
          onChange={e => setPwd(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && verifica()}
          placeholder="Password"
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            border: errore ? '2px solid #dc2626' : '1px solid #dde5f0',
            fontSize: 16,
            marginBottom: 8,
            boxSizing: 'border-box',
            textAlign: 'center',
            letterSpacing: 4
          }}
        />
        {errore && (
          <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 8 }}>
            Password non corretta
          </div>
        )}
        <button
          onClick={verifica}
          style={{
            width: '100%',
            background: VERDE,
            color: 'white',
            border: 'none',
            borderRadius: 10,
            padding: '14px',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer',
            marginTop: 8
          }}
        >
          Accedi →
        </button>
      </div>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f0f5f0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif',
      gap: 16
    }}>
      <img src="/logo_transparent.png" alt="Ambulatorio Millefonti"
        style={{ height: 160, objectFit: 'contain', marginBottom: 16 }} />
      <div style={{ color: VERDE, fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
        Chi sei?
      </div>
      {RUOLI.map(r => (
        <button
          key={r.path}
          onClick={() => navigate(r.path)}
          style={{
            background: 'white',
            color: VERDE,
            border: `2px solid ${VERDE}`,
            borderRadius: 14,
            padding: '16px 48px',
            fontSize: 18,
            fontWeight: 700,
            cursor: 'pointer',
            minWidth: 280,
            transition: 'all 0.2s'
          }}
          onMouseOver={e => {
            e.target.style.background = VERDE
            e.target.style.color = 'white'
          }}
          onMouseOut={e => {
            e.target.style.background = 'white'
            e.target.style.color = VERDE
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}
