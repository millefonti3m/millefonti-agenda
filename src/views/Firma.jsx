import { useRef, useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import SignatureCanvas from 'react-signature-canvas'
import { supabase } from '../supabase'

const VERDE = '#255736'
const TEAL = '#2d7d6f'

export default function Firma() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const sigRef = useRef(null)
  const [paziente, setPaziente] = useState(null)
  const [salvando, setSalvando] = useState(false)
  const [completato, setCompletato] = useState(false)

  const pazienteId = searchParams.get('id')

  useEffect(() => {
    if (!pazienteId) return
    supabase
      .from('pazienti_attesa')
      .select('*')
      .eq('id', pazienteId)
      .single()
      .then(({ data }) => setPaziente(data))
  }, [pazienteId])

  const pulisci = () => sigRef.current?.clear()

  const salva = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) return
    setSalvando(true)
    const firmaBase64 = sigRef.current.toDataURL('image/png')
    await supabase
      .from('pazienti_attesa')
      .update({ firma_digitale: firmaBase64 })
      .eq('id', pazienteId)
    setCompletato(true)
    setSalvando(false)
    setTimeout(() => navigate('/'), 2000)
  }

  if (completato) return (
    <div style={{
      minHeight: '100vh',
      background: '#f0f5f0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif'
    }}>
      <img src="/logo_transparent.png" alt="logo"
        style={{ height: 120, marginBottom: 32 }} />
      <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
      <div style={{ color: VERDE, fontSize: 24, fontWeight: 700 }}>
        Firma acquisita
      </div>
      <div style={{ color: '#888', fontSize: 16, marginTop: 8 }}>
        Grazie, si accomodi in sala d'attesa
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
      padding: 24
    }}>
      <img src="/logo_transparent.png" alt="logo"
        style={{ height: 100, marginBottom: 24 }} />

      {paziente ? (
        <>
          <div style={{
            color: VERDE,
            fontSize: 20,
            fontWeight: 700,
            marginBottom: 4
          }}>
            Consenso informato
          </div>
          <div style={{ color: '#888', fontSize: 16, marginBottom: 32 }}>
            {paziente.nome} — N° {paziente.numero_progressivo}
          </div>

          <div style={{
            background: 'white',
            borderRadius: 20,
            padding: 32,
            boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
            width: '100%',
            maxWidth: 600
          }}>
            <div style={{
              color: '#333',
              fontSize: 14,
              lineHeight: 1.8,
              marginBottom: 24,
              padding: 16,
              background: '#f8faf8',
              borderRadius: 10,
              border: '1px solid #e2e8f0'
            }}>
              Il/La sottoscritto/a dichiara di aver ricevuto
              adeguata informazione in merito alla prestazione
              sanitaria richiesta e presta il consenso al
              trattamento dei propri dati personali ai sensi
              del Regolamento UE 2016/679 (GDPR).
            </div>

            <div style={{ color: '#888', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>
              Firmare nel riquadro sottostante
            </div>

            <div style={{
              border: '2px solid #dde5f0',
              borderRadius: 12,
              overflow: 'hidden',
              marginBottom: 20,
              background: 'white'
            }}>
              <SignatureCanvas
                ref={sigRef}
                canvasProps={{
                  width: 550,
                  height: 200,
                  style: { display: 'block', touchAction: 'none' }
                }}
                penColor={VERDE}
              />
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={pulisci}
                style={{
                  flex: 1,
                  background: '#e2e8f0',
                  color: '#333',
                  border: 'none',
                  borderRadius: 10,
                  padding: '14px',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                🗑 Cancella
              </button>
              <button
                onClick={salva}
                disabled={salvando}
                style={{
                  flex: 2,
                  background: salvando ? '#ccc' : VERDE,
                  color: 'white',
                  border: 'none',
                  borderRadius: 10,
                  padding: '14px',
                  fontSize: 16,
                  fontWeight: 700,
                  cursor: salvando ? 'not-allowed' : 'pointer'
                }}
              >
                {salvando ? '⏳ Salvataggio...' : '✅ Conferma firma'}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div style={{ color: '#888', fontSize: 18 }}>
          Caricamento...
        </div>
      )}
    </div>
  )
}
