import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../supabase'

const VERDE = '#2d7d6f'
const SFONDO = '#f0f4f8'

export default function Studio() {
  const { numero } = useParams()
  const [nomeMedico, setNomeMedico] = useState('')
  const [inputNome, setInputNome] = useState('')
  const [pazienti, setPazienti] = useState([])
  const [loading, setLoading] = useState(false)
  const [sessione, setSessione] = useState(null)
  const [testoAnnuncio, setTestoAnnuncio] = useState('')
  const [inviandoAnnuncio, setInviandoAnnuncio] = useState(false)

  const inviaAnnuncio = async () => {
    if (!testoAnnuncio.trim()) return
    setInviandoAnnuncio(true)
    await supabase.from('chiamate_display').insert({
      numero_paziente: 0,
      destinazione: `Studio ${numero}`,
      testo_voce: testoAnnuncio.trim()
    })
    setTestoAnnuncio('')
    setInviandoAnnuncio(false)
  }

  const getSessione = async () => {
    const oggi = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('sessioni_attesa')
      .select('id')
      .eq('data', oggi)
      .single()
    return data
  }

  const caricaPazienti = async (sess) => {
    if (!sess) return
    const { data } = await supabase
      .from('pazienti_attesa')
      .select('*')
      .eq('sessione_id', sess.id)
      .in('stato', ['in_attesa', 'pronto', 'in_infermeria'])
      .order('stato', { ascending: false })
      .order('orario_appuntamento', { ascending: true })
    if (data) setPazienti(data)
  }

  const iniziaTurno = async () => {
    if (!inputNome.trim()) return
    const oggi = new Date().toISOString().split('T')[0]
    await supabase.from('medici_giornalieri').upsert({
      data: oggi,
      nome_medico: inputNome.trim(),
      studio: parseInt(numero)
    }, { onConflict: 'data,studio' })
    setNomeMedico(inputNome.trim())
    localStorage.setItem(`medico_studio_${numero}`, JSON.stringify({
      nome: inputNome.trim(),
      data: oggi
    }))
    const sess = await getSessione()
    setSessione(sess)
    caricaPazienti(sess)
  }

  const chiamaPaziente = async (paziente) => {
    setLoading(true)

    // Completa automaticamente il paziente in visita
    const { data: inVisita } = await supabase
      .from('pazienti_attesa')
      .select('id')
      .eq('sessione_id', sessione.id)
      .eq('stato', 'in_visita')
      .eq('studio_assegnato', parseInt(numero))
      .maybeSingle()

    if (inVisita) {
      await supabase
        .from('pazienti_attesa')
        .update({ stato: 'completato' })
        .eq('id', inVisita.id)
    }

    await supabase
      .from('pazienti_attesa')
      .update({
        stato: 'in_visita',
        studio_assegnato: parseInt(numero),
        timestamp_chiamata: new Date().toISOString()
      })
      .eq('id', paziente.id)

    const studioTesto = ['uno', 'due', 'tre'][parseInt(numero) - 1]
    const testo = `Numero ${paziente.numero_progressivo}, prego recarsi allo studio ${studioTesto}`
    await supabase.from('chiamate_display').insert({
      numero_paziente: paziente.numero_progressivo,
      destinazione: `Studio ${numero}`,
      testo_voce: testo
    })
    setLoading(false)
  }

  const prossimoPaziente = async () => {
    // Prima i pronti, poi gli altri per orario
    const pronti = pazienti.filter(p => p.stato === 'pronto')
    const attesa = pazienti.filter(p => p.stato === 'in_attesa')
    const prossimo = pronti[0] || attesa[0]
    if (prossimo) chiamaPaziente(prossimo)
  }

  const completaVisita = async (paziente) => {
    await supabase
      .from('pazienti_attesa')
      .update({ stato: 'completato' })
      .eq('id', paziente.id)
  }

  useEffect(() => {
    // Controlla localStorage
    const saved = localStorage.getItem(`medico_studio_${numero}`)
    if (saved) {
      const parsed = JSON.parse(saved)
      const oggi = new Date().toISOString().split('T')[0]
      if (parsed.data === oggi) {
        setNomeMedico(parsed.nome)
        getSessione().then(sess => {
          setSessione(sess)
          caricaPazienti(sess)
        })
      }
    }
  }, [numero])

  useEffect(() => {
    if (!sessione) return
    const sub = supabase
      .channel('studio_' + numero)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pazienti_attesa'
      }, () => caricaPazienti(sessione))
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [sessione])

  const getBadge = (p) => {
    const badges = []
    if (p.necessita_ecg) badges.push(
      <span key="ecg" style={{ background: '#fff3cd', color: '#856404', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>⚡ ECG</span>
    )
    if (p.necessita_prelievo) badges.push(
      <span key="prel" style={{ background: '#f8d7da', color: '#721c24', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>🩸 Prelievo</span>
    )
    if (p.stato === 'pronto') badges.push(
      <span key="pronto" style={{ background: '#d4edda', color: '#155724', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>✅ Pronto</span>
    )
    if (p.necessita_audio) badges.push(
      <span key="audio" style={{ background: '#dbeafe', color: '#1e40af', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>🎧 Audio</span>
    )
    if (p.necessita_spiro) badges.push(
      <span key="spiro" style={{ background: '#fce7f3', color: '#9d174d', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>💨 Spiro</span>
    )
    if (p.necessita_vesti) badges.push(
      <span key="vesti" style={{ background: '#ede9fe', color: '#5b21b6', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>👗 Vesti</span>
    )
    if (p.necessita_erg) badges.push(
      <span key="erg" style={{ background: '#fef3c7', color: '#92400e', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>🏋️ Erg</span>
    )
    if (p.necessita_etil) badges.push(
      <span key="etil" style={{ background: '#fee2e2', color: '#991b1b', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>🍷 Etil</span>
    )
    if (p.necessita_td) badges.push(
      <span key="td" style={{ background: '#d1fae5', color: '#065f46', padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>💉 TD</span>
    )
    if (p.necessita_prelievo && p.esami_sangue) badges.push(
      <span key="esami" style={{ background: '#f8d7da', color: '#721c24', padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>🩸 {p.esami_sangue}</span>
    )
    return badges
  }

  // Schermata login medico
  if (!nomeMedico) return (
    <div style={{
      minHeight: '100vh',
      background: SFONDO,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif'
    }}>
      <img src="/logo_transparent.png" alt="Ambulatorio Millefonti" style={{ height: 100, objectFit: 'contain', marginBottom: 8 }} />
      <div style={{ color: '#333', fontSize: 28, fontWeight: 700, marginBottom: 32 }}>
        Studio {numero}
      </div>
      <div style={{
        background: 'white',
        borderRadius: 20,
        padding: 40,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        minWidth: 320
      }}>
        <div style={{ color: '#333', fontSize: 16, marginBottom: 16, fontWeight: 600 }}>
          Chi sei oggi?
        </div>
        <input
          value={inputNome}
          onChange={e => setInputNome(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && iniziaTurno()}
          placeholder="Nome e cognome"
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: 10,
            border: '1px solid #dde5f0',
            fontSize: 16,
            marginBottom: 16,
            boxSizing: 'border-box'
          }}
        />
        <button
          onClick={iniziaTurno}
          style={{
            width: '100%',
            background: VERDE,
            color: 'white',
            border: 'none',
            borderRadius: 10,
            padding: '14px',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          Inizia turno →
        </button>
      </div>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: SFONDO,
      fontFamily: 'Arial, sans-serif',
      padding: 24
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
      }}>
        <div>
          <img src="/logo_transparent.png" alt="Ambulatorio Millefonti" style={{ height: 100, objectFit: 'contain' }} />
          <div style={{ color: '#333', fontSize: 20, fontWeight: 700 }}>
            Dott. {nomeMedico}
          </div>
        </div>
        <button
          onClick={prossimoPaziente}
          disabled={loading || pazienti.length === 0}
          style={{
            background: loading ? '#ccc' : VERDE,
            color: 'white',
            border: 'none',
            borderRadius: 12,
            padding: '14px 28px',
            fontSize: 16,
            fontWeight: 700,
            cursor: 'pointer'
          }}
        >
          → Prossimo
        </button>
      </div>

      {/* Lista pazienti */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {pazienti.length === 0 && (
          <div style={{ color: '#888', textAlign: 'center', marginTop: 60, fontSize: 18 }}>
            Nessun paziente in attesa
          </div>
        )}
        {pazienti.map(p => (
          <div key={p.id} style={{
            background: p.stato === 'pronto' ? '#f0fff4' : 'white',
            border: p.stato === 'pronto' ? '2px solid #2d7d6f' : '1px solid #e2e8f0',
            borderRadius: 14,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
          }}>
            <div style={{
              fontSize: 32,
              fontWeight: 900,
              color: VERDE,
              minWidth: 60
            }}>
              {p.numero_progressivo}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
                {p.nome}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {getBadge(p)}
              </div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {p.azienda && <span>🏢 {p.azienda}</span>}
                {p.mansione && <span>👷 {p.mansione}</span>}
                {p.tipo_visita && <span>📋 {p.tipo_visita}</span>}
                {p.orario_appuntamento && <span>🕐 Prenotato: {p.orario_appuntamento}</span>}
                {p.timestamp_arrivo && <span>✅ Arrivato: {new Date(p.timestamp_arrivo).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>}
                {p.note_varie && <span style={{ color: '#d97706' }}>📝 {p.note_varie}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => chiamaPaziente(p)}
                style={{
                  background: VERDE,
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: 14
                }}
              >
                Chiama
              </button>
              <button
                onClick={() => completaVisita(p)}
                style={{
                  background: '#e2e8f0',
                  color: '#333',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 16px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontSize: 14
                }}
              >
                ✓ Fine
              </button>
            </div>
          </div>
        ))}
      </div>

      <div style={{
        background: 'white',
        borderRadius: 14,
        padding: 16,
        marginTop: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{
          color: VERDE, fontWeight: 700,
          fontSize: 14, marginBottom: 10
        }}>
          📢 Annuncio in sala d'attesa
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            value={testoAnnuncio}
            onChange={e => setTestoAnnuncio(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && inviaAnnuncio()}
            placeholder="Es. Studio 1 — portare il tesserino sanitario"
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 8,
              border: '1px solid #dde5f0',
              fontSize: 14
            }}
          />
          <button
            onClick={inviaAnnuncio}
            disabled={inviandoAnnuncio || !testoAnnuncio.trim()}
            style={{
              background: inviandoAnnuncio ? '#ccc' : VERDE,
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 14,
              whiteSpace: 'nowrap'
            }}
          >
            {inviandoAnnuncio ? '⏳' : '📢 Annuncia'}
          </button>
        </div>
      </div>
    </div>
  )
}
