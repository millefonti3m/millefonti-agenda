import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import * as pdfjsLib from 'pdfjs-dist'
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

const VERDE = '#2d7d6f'
const SFONDO = '#f0f4f8'

const STATO_COLORI = {
  non_arrivato: { bg: '#f0f4f8', color: '#888', label: '⚪ Non arrivato' },
  in_attesa:    { bg: '#e8f4f8', color: '#0066cc', label: '🔵 In attesa' },
  in_infermeria:{ bg: '#fff3cd', color: '#856404', label: '🟠 In infermeria' },
  pronto:       { bg: '#d4edda', color: '#155724', label: '🟢 Pronto' },
  in_visita:    { bg: '#e8d5f5', color: '#6f42c1', label: '🟣 In visita' },
  completato:   { bg: '#d4edda', color: '#155724', label: '✅ Completato' },
}

export default function Segreteria() {
  const [pazienti, setPazienti] = useState([])
  const [sessione, setSessione] = useState(null)
  const [nomeNuovo, setNomeNuovo] = useState('')
  const [orarioNuovo, setOrarioNuovo] = useState('')
  const [ecgNuovo, setEcgNuovo] = useState(false)
  const [prelNuovo, setPrelNuovo] = useState(false)
  const [contatore, setContatore] = useState(1)
  const [dataSelezionata, setDataSelezionata] = useState(new Date())

  const getOCreaSessione = async () => {
    const dataStr = dataSelezionata.toISOString().split('T')[0]
    let { data } = await supabase
      .from('sessioni_attesa')
      .select('id')
      .eq('data', dataStr)
      .single()
    if (!data) {
      const { data: nuova } = await supabase
        .from('sessioni_attesa')
        .insert({ data: dataStr })
        .select()
        .single()
      data = nuova
    }
    setSessione(data)
    return data
  }

  const caricaPazienti = async (sess) => {
    if (!sess) return
    const { data } = await supabase
      .from('pazienti_attesa')
      .select('*')
      .eq('sessione_id', sess.id)
      .order('orario_appuntamento', { ascending: true })
    if (data) {
      setPazienti(data)
      const maxNum = Math.max(0, ...data.map(p => p.numero_progressivo || 0))
      setContatore(maxNum + 1)
    }
  }

  const segnaArrivato = async (paziente) => {
    if (paziente.arrivato) return
    await supabase
      .from('pazienti_attesa')
      .update({
        arrivato: true,
        stato: 'in_attesa',
        numero_progressivo: contatore,
        timestamp_arrivo: new Date().toISOString()
      })
      .eq('id', paziente.id)
      .select()
      .single()
    setContatore(c => c + 1)
  }

  const aggiungiManuale = async () => {
    if (!nomeNuovo.trim() || !sessione) return
    await supabase.from('pazienti_attesa').insert({
      sessione_id: sessione.id,
      nome: nomeNuovo.trim(),
      orario_appuntamento: orarioNuovo || null,
      necessita_ecg: ecgNuovo,
      necessita_prelievo: prelNuovo,
      stato: 'non_arrivato',
      arrivato: false
    })
    setNomeNuovo('')
    setOrarioNuovo('')
    setEcgNuovo(false)
    setPrelNuovo(false)
  }

  const importaExcel = async (e) => {
    const file = e.target.files[0]
    if (!file || !sessione) return
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer)
    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(ws)
    const records = rows.map(r => ({
      sessione_id: sessione.id,
      nome: r['Nome'] || r['nome'] || r['NOME'] || '',
      orario_appuntamento: r['Orario'] || r['orario'] || null,
      necessita_ecg: !!(r['ECG'] || r['ecg']),
      necessita_prelievo: !!(r['Prelievo'] || r['prelievo']),
      stato: 'non_arrivato',
      arrivato: false
    })).filter(r => r.nome)
    if (records.length) {
      await supabase.from('pazienti_attesa').insert(records)
    }
  }

  const importaPDF = async (e) => {
    const file = e.target.files[0]
    if (!file || !sessione) return
    const buffer = await file.arrayBuffer()
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
    const tuttiRighe = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const content = await page.getTextContent()
      const testo = content.items.map(item => item.str).join(' ')
      tuttiRighe.push(testo)
    }
    const righe = tuttiRighe.join('\n').split('\n')
    const records = righe
      .map(r => r.trim())
      .filter(r => r.length > 3)
      .map(r => {
        const orarioMatch = r.match(/\b(\d{1,2}[:.]\d{2})\b/)
        const ecg = /ecg/i.test(r)
        const prelievo = /prelievo|esame/i.test(r)
        const nome = r.replace(/\d{1,2}[:.]\d{2}/, '').replace(/ecg|prelievo|esame/gi, '').trim()
        return {
          sessione_id: sessione.id,
          nome: nome || r,
          orario_appuntamento: orarioMatch ? orarioMatch[1].replace('.', ':') : null,
          necessita_ecg: ecg,
          necessita_prelievo: prelievo,
          stato: 'non_arrivato',
          arrivato: false
        }
      })
      .filter(r => r.nome && r.nome.length > 2)
    if (records.length) {
      await supabase.from('pazienti_attesa').insert(records)
    }
  }

  useEffect(() => {
    getOCreaSessione().then(sess => caricaPazienti(sess))
  }, [dataSelezionata])

  useEffect(() => {
    if (!sessione) return
    const sub = supabase
      .channel('segreteria')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'pazienti_attesa'
      }, () => caricaPazienti(sessione))
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [sessione])

  return (
    <div style={{
      minHeight: '100vh',
      background: SFONDO,
      fontFamily: 'Arial, sans-serif',
      padding: 24
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
      }}>
        <div>
          <img src="/logo_transparent.png" alt="Ambulatorio Millefonti" style={{ height: 100, objectFit: 'contain' }} />
          <div style={{ color: '#333', fontSize: 22, fontWeight: 700 }}>
            Segreteria
          </div>
        </div>
      </div>

      {/* Pannello data + importa */}
      <div style={{
        background: 'white',
        borderRadius: 14,
        padding: '16px 20px',
        marginBottom: 20,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: VERDE, fontWeight: 700, fontSize: 14 }}>📅 Data lista:</span>
          <DatePicker
            selected={dataSelezionata}
            onChange={date => setDataSelezionata(date)}
            dateFormat="dd/MM/yyyy"
            style={{ fontSize: 14 }}
          />
        </div>
        <label style={{
          background: VERDE, color: 'white',
          borderRadius: 10, padding: '10px 20px',
          fontWeight: 700, cursor: 'pointer', fontSize: 14
        }}>
          📂 Excel
          <input type="file" accept=".xlsx,.xls,.csv" onChange={importaExcel} style={{ display: 'none' }} />
        </label>
        <label style={{
          background: '#2d7d6f', color: 'white',
          borderRadius: 10, padding: '10px 20px',
          fontWeight: 700, cursor: 'pointer', fontSize: 14
        }}>
          📄 PDF
          <input type="file" accept=".pdf" onChange={importaPDF} style={{ display: 'none' }} />
        </label>
      </div>

      {/* Aggiungi manuale */}
      <div style={{
        background: 'white',
        borderRadius: 14,
        padding: 20,
        marginBottom: 24,
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        <input
          value={nomeNuovo}
          onChange={e => setNomeNuovo(e.target.value)}
          placeholder="Nome paziente"
          style={{
            flex: 2,
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid #dde5f0',
            fontSize: 14,
            minWidth: 180
          }}
        />
        <input
          type="time"
          value={orarioNuovo}
          onChange={e => setOrarioNuovo(e.target.value)}
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            border: '1px solid #dde5f0',
            fontSize: 14
          }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={ecgNuovo} onChange={e => setEcgNuovo(e.target.checked)} />
          ⚡ ECG
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
          <input type="checkbox" checked={prelNuovo} onChange={e => setPrelNuovo(e.target.checked)} />
          🩸 Prelievo
        </label>
        <button
          onClick={aggiungiManuale}
          style={{
            background: VERDE,
            color: 'white',
            border: 'none',
            borderRadius: 8,
            padding: '10px 20px',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          + Aggiungi
        </button>
      </div>

      {/* Lista pazienti */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pazienti.map(p => {
          const s = STATO_COLORI[p.stato] || STATO_COLORI.non_arrivato
          const completato = p.stato === 'completato'
          return (
            <div key={p.id} style={{
              background: completato ? '#f0fff4' : 'white',
              border: completato ? '2px solid #2d7d6f' : '1px solid #e2e8f0',
              borderRadius: 14,
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
            }}>
              {/* Numero */}
              <div style={{
                fontSize: 28,
                fontWeight: 900,
                color: p.arrivato ? VERDE : '#ccc',
                minWidth: 50,
                textAlign: 'center'
              }}>
                {p.numero_progressivo || '—'}
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 16 }}>{p.nome}</div>
                <div style={{ fontSize: 13, color: '#888' }}>
                  {p.orario_appuntamento || '—'}
                  {p.necessita_ecg && ' · ⚡ ECG'}
                  {p.necessita_prelievo && ' · 🩸 Prelievo'}
                </div>
              </div>

              {/* Stato */}
              <div style={{
                background: s.bg,
                color: s.color,
                padding: '6px 14px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 700,
                whiteSpace: 'nowrap'
              }}>
                {s.label}
              </div>

              {/* Azione */}
              {!p.arrivato && (
                <button
                  onClick={() => segnaArrivato(p)}
                  style={{
                    background: VERDE,
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    padding: '8px 16px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 13,
                    whiteSpace: 'nowrap'
                  }}
                >
                  ✓ Arrivato
                </button>
              )}
              {completato && (
                <div style={{
                  color: VERDE,
                  fontWeight: 700,
                  fontSize: 13,
                  whiteSpace: 'nowrap'
                }}>
                  📋 Ritira numero
                </div>
              )}
            </div>
          )
        })}
        {pazienti.length === 0 && (
          <div style={{ color: '#888', textAlign: 'center', marginTop: 60, fontSize: 18 }}>
            Nessun paziente — importa Excel o aggiungi manualmente
          </div>
        )}
      </div>
    </div>
  )
}
