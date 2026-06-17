import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const VERDE_SCURO = '#255736'
const VERDE_MEDIO = '#2d7d6f'
const TEAL = '#437953'
const FONT_TITOLO = "'Playfair Display', Georgia, serif"
const FONT_BODY = "'Plus Jakarta Sans', Arial, sans-serif"

export default function Display() {
  const [chiamata, setChiamata] = useState(null)
  const [inVisita, setInVisita] = useState([])

  const caricaUltima = async () => {
    const { data } = await supabase
      .from('chiamate_display')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
    if (data?.length) {
      setChiamata(data[0])
    }
  }

  const caricaInVisita = async () => {
    const oggi = new Date().toISOString().split('T')[0]
    const { data: sess } = await supabase
      .from('sessioni_attesa')
      .select('id')
      .eq('data', oggi)
      .maybeSingle()
    if (!sess) return
    const { data } = await supabase
      .from('pazienti_attesa')
      .select('numero_progressivo, studio_assegnato')
      .eq('sessione_id', sess.id)
      .eq('stato', 'in_visita')
      .order('studio_assegnato')
    if (data) setInVisita(data)
  }

  useEffect(() => {
    caricaUltima()
    caricaInVisita()
    const sub = supabase
      .channel('display')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chiamate_display'
      }, (payload) => {
        setChiamata(payload.new)
        const utterance = new SpeechSynthesisUtterance(payload.new.testo_voce)
        utterance.lang = 'it-IT'
        utterance.rate = 0.9
        window.speechSynthesis.speak(utterance)
        caricaInVisita()
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
          src="/logo_transparent.png"
          alt="Ambulatorio Millefonti"
          style={{
            width: 280,
            height: 280,
            objectFit: 'contain',
            animation: 'fadeIn 1.5s ease-in-out',
            filter: 'drop-shadow(0 4px 16px rgba(45,125,111,0.15))'
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
          {chiamata.numero_paziente === 0 ? (
            <div style={{
              color: VERDE_SCURO,
              fontSize: 48,
              fontWeight: 700,
              fontFamily: FONT_TITOLO,
              lineHeight: 1.3,
              marginBottom: 28,
              maxWidth: 700,
              animation: 'slideUp 0.5s ease-out'
            }}>
              📢 {chiamata.testo_voce}
            </div>
          ) : (
            <>
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
            </>
          )}
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

      {/* Pazienti in visita per studio */}
      {inVisita.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 40,
          display: 'flex',
          gap: 20
        }}>
          {inVisita.map(p => (
            <div key={p.numero_progressivo} style={{
              background: '#f0f5f0',
              borderRadius: 12,
              padding: '10px 24px',
              color: '#255736',
              fontSize: 18,
              fontWeight: 700,
              border: '2px solid #2d7d6f'
            }}>
              N° {p.numero_progressivo} → Studio {p.studio_assegnato}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
