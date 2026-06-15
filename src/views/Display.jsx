import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const VERDE_SCURO = '#255736'
const VERDE_MEDIO = '#2d7d6f'
const TEAL = '#437953'
const FONT_TITOLO = "'Playfair Display', Georgia, serif"
const FONT_BODY = "'Plus Jakarta Sans', Arial, sans-serif"

export default function Display() {
  const [chiamata, setChiamata] = useState(null)
  const [storico, setStorico] = useState([])

  const caricaUltima = async () => {
    const { data } = await supabase
      .from('chiamate_display')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(4)
    if (data?.length) {
      setChiamata(data[0])
      setStorico(data.slice(1))
    }
  }

  useEffect(() => {
    caricaUltima()
    const sub = supabase
      .channel('display')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chiamate_display'
      }, (payload) => {
        setChiamata(payload.new)
        setStorico(prev => [payload.new, ...prev].slice(0, 3))
        const utterance = new SpeechSynthesisUtterance(payload.new.testo_voce)
        utterance.lang = 'it-IT'
        utterance.rate = 0.9
        window.speechSynthesis.speak(utterance)
      })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  return (
    <div style={{
      background: '#ffffff',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: FONT_BODY,
      padding: 40
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <img
          src="/logo_definitivo.png"
          alt="Ambulatorio Millefonti"
          style={{
            width: 280,
            height: 280,
            objectFit: 'contain',
            animation: 'fadeIn 1.5s ease-in-out',
            filter: 'drop-shadow(0 4px 16px rgba(45,125,111,0.15))',
            mixBlendMode: 'multiply'
          }}
        />
      </div>

      {/* Linea separatrice */}
      <div style={{
        width: 120,
        height: 3,
        background: VERDE_MEDIO,
        borderRadius: 2,
        marginBottom: 64
      }} />

      {/* Chiamata principale */}
      {chiamata ? (
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{
            color: '#aaa',
            fontSize: 18,
            fontFamily: FONT_BODY,
            fontWeight: 600,
            letterSpacing: 4,
            textTransform: 'uppercase',
            marginBottom: 16
          }}>
            Numero
          </div>
          <div style={{
            color: VERDE_SCURO,
            fontSize: 180,
            fontWeight: 900,
            fontFamily: FONT_TITOLO,
            lineHeight: 1,
            marginBottom: 28,
            animation: 'slideUp 0.5s ease-out'
          }}>
            {chiamata.numero_paziente}
          </div>
          <div style={{
            color: VERDE_MEDIO,
            fontSize: 30,
            fontFamily: FONT_BODY,
            fontWeight: 600,
            letterSpacing: 1
          }}>
            {chiamata.destinazione}
          </div>
        </div>
      ) : (
        <div style={{
          color: '#888',
          fontSize: 28,
          fontFamily: FONT_BODY,
          marginBottom: 64
        }}>
          In attesa di chiamate...
        </div>
      )}

      {/* Storico ultimi 3 */}
      {storico.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 40,
          display: 'flex',
          gap: 20
        }}>
          {storico.map((s) => (
            <div key={s.id} style={{
              background: '#f0f5f0',
              border: `1px solid ${VERDE_MEDIO}`,
              borderRadius: 12,
              padding: '12px 28px',
              color: TEAL,
              fontSize: 17,
              fontFamily: FONT_BODY,
              fontWeight: 600
            }}>
              N° {s.numero_paziente} → {s.destinazione}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
