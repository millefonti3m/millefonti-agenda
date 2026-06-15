import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

export default function Display() {
  const [chiamata, setChiamata] = useState(null)
  const [storico, setStorico] = useState([])

  // Carica ultima chiamata
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

  // Realtime
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
        // Voce italiana
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
      background: '#0a0a0a',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif',
      padding: 40
    }}>
      {/* Logo */}
      <div style={{ color: '#2d7d6f', fontSize: 18, fontWeight: 700, marginBottom: 60, letterSpacing: 2 }}>
        AMBULATORIO MILLEFONTI
      </div>

      {/* Chiamata principale */}
      {chiamata ? (
        <div style={{ textAlign: 'center', marginBottom: 60 }}>
          <div style={{ color: '#888', fontSize: 22, marginBottom: 16 }}>
            NUMERO
          </div>
          <div style={{
            color: '#ffffff',
            fontSize: 160,
            fontWeight: 900,
            lineHeight: 1,
            marginBottom: 24
          }}>
            {chiamata.numero_paziente}
          </div>
          <div style={{ color: '#888', fontSize: 28, marginBottom: 12 }}>
            {chiamata.destinazione}
          </div>
        </div>
      ) : (
        <div style={{ color: '#333', fontSize: 32 }}>
          In attesa di chiamate...
        </div>
      )}

      {/* Storico ultimi 3 */}
      {storico.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 40,
          display: 'flex',
          gap: 24
        }}>
          {storico.map((s, i) => (
            <div key={s.id} style={{
              background: '#1a1a1a',
              borderRadius: 12,
              padding: '12px 24px',
              color: '#555',
              fontSize: 18
            }}>
              N° {s.numero_paziente} → {s.destinazione}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
