import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const VERDE = '#2d7d6f'
const SFONDO = '#f0f4f8'

export default function Infermeria() {
  const [pazienteAttuale, setPazienteAttuale] = useState(null)
  const [loading, setLoading] = useState(false)

  const caricaPazienteAttuale = async () => {
    const oggi = new Date().toISOString().split('T')[0]
    const { data: sessione } = await supabase
      .from('sessioni_attesa')
      .select('id')
      .eq('data', oggi)
      .single()
    if (!sessione) return

    const { data } = await supabase
      .from('pazienti_attesa')
      .select('*')
      .eq('sessione_id', sessione.id)
      .eq('stato', 'in_infermeria')
      .single()
    setPazienteAttuale(data || null)
  }

  const prossimoPaziente = async () => {
    setLoading(true)
    const oggi = new Date().toISOString().split('T')[0]
    const { data: sessione } = await supabase
      .from('sessioni_attesa')
      .select('id')
      .eq('data', oggi)
      .single()
    if (!sessione) { setLoading(false); return }

    // Completa paziente attuale
    if (pazienteAttuale) {
      await supabase
        .from('pazienti_attesa')
        .update({ stato: 'pronto' })
        .eq('id', pazienteAttuale.id)
    }

    // Trova prossimo in attesa con necessita_ecg o necessita_prelievo
    const { data: prossimo } = await supabase
      .from('pazienti_attesa')
      .select('*')
      .eq('sessione_id', sessione.id)
      .eq('stato', 'in_attesa')
      .or('necessita_ecg.eq.true,necessita_prelievo.eq.true')
      .order('orario_appuntamento', { ascending: true })
      .limit(1)
      .single()

    if (prossimo) {
      await supabase
        .from('pazienti_attesa')
        .update({ stato: 'in_infermeria', timestamp_chiamata: new Date().toISOString() })
        .eq('id', prossimo.id)

      // Inserisci chiamata display
      const testo = `Numero ${prossimo.numero_progressivo}, prego recarsi all'infermeria`
      await supabase.from('chiamate_display').insert({
        numero_paziente: prossimo.numero_progressivo,
        destinazione: 'Infermeria',
        testo_voce: testo
      })

      setPazienteAttuale(prossimo)
    } else {
      setPazienteAttuale(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    caricaPazienteAttuale()
    const sub = supabase
      .channel('infermeria')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'pazienti_attesa'
      }, () => caricaPazienteAttuale())
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  return (
    <div style={{
      minHeight: '100vh',
      background: SFONDO,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif',
      padding: 32
    }}>
      <div style={{ marginBottom: 48, display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/logo_transparent.png" alt="Ambulatorio Millefonti" style={{ height: 100, objectFit: 'contain' }} />
        <span style={{ color: VERDE, fontSize: 20, fontWeight: 700 }}>Infermeria</span>
      </div>

      {/* Paziente attuale */}
      {pazienteAttuale ? (
        <div style={{
          background: 'white',
          borderRadius: 20,
          padding: 40,
          textAlign: 'center',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          marginBottom: 32,
          minWidth: 320
        }}>
          <div style={{ color: '#888', fontSize: 14, marginBottom: 8 }}>PAZIENTE ATTUALE</div>
          <div style={{ fontSize: 48, fontWeight: 900, color: '#1a1a1a', marginBottom: 8 }}>
            N° {pazienteAttuale.numero_progressivo}
          </div>
          <div style={{ fontSize: 22, color: '#333', marginBottom: 24 }}>
            {pazienteAttuale.nome}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 8 }}>
            {pazienteAttuale.necessita_ecg && (
              <span style={{
                background: '#fff3cd',
                color: '#856404',
                padding: '6px 16px',
                borderRadius: 20,
                fontWeight: 700,
                fontSize: 14
              }}>⚡ ECG</span>
            )}
            {pazienteAttuale.necessita_prelievo && (
              <span style={{
                background: '#f8d7da',
                color: '#721c24',
                padding: '6px 16px',
                borderRadius: 20,
                fontWeight: 700,
                fontSize: 14
              }}>🩸 Prelievo</span>
            )}
          </div>
        </div>
      ) : (
        <div style={{
          color: '#888',
          fontSize: 20,
          marginBottom: 32
        }}>
          Nessun paziente in infermeria
        </div>
      )}

      {/* Bottone prossimo */}
      <button
        onClick={prossimoPaziente}
        disabled={loading}
        style={{
          background: loading ? '#ccc' : VERDE,
          color: 'white',
          border: 'none',
          borderRadius: 16,
          padding: '20px 48px',
          fontSize: 22,
          fontWeight: 700,
          cursor: loading ? 'not-allowed' : 'pointer',
          boxShadow: '0 4px 16px rgba(45,125,111,0.3)'
        }}
      >
        {loading ? '⏳ Caricamento...' : '→ Prossimo paziente'}
      </button>
    </div>
  )
}
