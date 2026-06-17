import { useEffect, useState } from 'react'
import { supabase } from '../supabase'
import * as XLSX from 'xlsx'
import GestioneDocumenti from '../components/GestioneDocumenti'
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
  const [documentoAttivo, setDocumentoAttivo] = useState(null)

  const getOCreaSessione = async () => {
    const dataStr = dataSelezionata.toISOString().split('T')[0]
    let { data } = await supabase
      .from('sessioni_attesa')
      .select('id')
      .eq('data', dataStr)
      .maybeSingle()
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

  const svuotaLista = async () => {
    if (!sessione) return
    const conferma = window.confirm(
      'Sei sicuro di voler eliminare tutti i pazienti di oggi?'
    )
    if (!conferma) return
    await supabase
      .from('pazienti_attesa')
      .delete()
      .eq('sessione_id', sessione.id)
    caricaPazienti(sessione)
  }

  const importaExcel = async (e) => {
    const file = e.target.files[0]
    if (!file || !sessione) return

    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })

    // Se più fogli, chiedi quale usare
    let sheetName = wb.SheetNames[0]
    if (wb.SheetNames.length > 1) {
      const scelta = window.prompt(
        'Fogli disponibili:\n' +
        wb.SheetNames.map((n, i) => `${i+1}. ${n}`).join('\n') +
        '\n\nInserisci il numero del foglio da importare:',
        '1'
      )
      const idx = parseInt(scelta) - 1
      if (!isNaN(idx) && wb.SheetNames[idx]) {
        sheetName = wb.SheetNames[idx]
      }
    }

    const ws = wb.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    // Trova riga header
    let headerIdx = -1
    let headerRow = []
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const r = rows[i].map(c => String(c).toUpperCase().trim())
      if (r.includes('NOMINATIVO') || r.includes('AZIENDA')) {
        headerIdx = i
        headerRow = r
        break
      }
    }
    if (headerIdx === -1) { alert('Intestazione non trovata nel foglio'); return }

    const col = (name) => {
      const idx = headerRow.findIndex(h => h.includes(name))
      return idx >= 0 ? idx : -1
    }

    // Indici colonne
    const iOra = col('ORA')
    const iAzienda = col('AZIENDA')
    const iNominativo = col('NOMINATIVO')
    const iSesso = col('S')
    const iCF = col('CF')
    const iMansione = col('MANSIONE')
    const iVisita = col('VISITA')
    const iAudio = col('AUDIO')
    const iSpiro = col('SPIRO')
    const iEcg = col('ECG')
    const iEsami = col('ESAMI')
    const iVesti = col('VESTI')
    const iErg = col('ERG')
    const iEtil = col('ETIL')
    const iTd = col('TD')
    const iVarie = col('VARIE')

    const parseOra = (val) => {
      if (!val) return null
      const s = String(val).trim()

      // Stringa tipo "08:30nm" o "08:30" o "08:30:00"
      const match = s.match(/(\d{1,2})[:.]\s*(\d{2})/)
      if (match) {
        const h = parseInt(match[1])
        const m = parseInt(match[2])
        // scarta valori impossibili come 00:33 che sono decimali mal parsati
        if (h >= 1 || m === 0) {
          return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
        }
      }

      // Numero decimale Excel (frazione di giorno)
      const n = parseFloat(val)
      if (!isNaN(n) && n > 0 && n < 1) {
        const totalMin = Math.round(n * 24 * 60)
        const h = Math.floor(totalMin / 60)
        const m = totalMin % 60
        return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
      }

      return null
    }

    const parseNome = (val) => {
      if (!val) return ''
      return String(val).replace(/\d{1,2}\/\d{1,2}\/\d{4}/, '').trim()
    }

    const isX = (val) => String(val).toUpperCase().trim() === 'X'

    const records = []
    for (let i = headerIdx + 1; i < rows.length; i++) {
      const r = rows[i]
      const nominativo = iNominativo >= 0 ? String(r[iNominativo] || '').trim() : ''
      if (!nominativo) continue

      const nome = parseNome(nominativo)
      if (!nome || nome.length < 2) continue

      records.push({
        sessione_id: sessione.id,
        nome,
        orario_appuntamento: iOra >= 0 ? parseOra(r[iOra]) : null,
        azienda: iAzienda >= 0 ? String(r[iAzienda] || '').trim() : null,
        sesso: iSesso >= 0 ? String(r[iSesso] || '').trim() : null,
        codice_fiscale: iCF >= 0 ? String(r[iCF] || '').trim() : null,
        mansione: iMansione >= 0 ? String(r[iMansione] || '').trim() : null,
        tipo_visita: iVisita >= 0 ? String(r[iVisita] || '').trim() : null,
        necessita_ecg: iEcg >= 0 ? isX(r[iEcg]) : false,
        necessita_prelievo: iEsami >= 0 ? !!String(r[iEsami] || '').trim() : false,
        esami_sangue: iEsami >= 0 ? String(r[iEsami] || '').trim() || null : null,
        necessita_audio: iAudio >= 0 ? isX(r[iAudio]) : false,
        necessita_spiro: iSpiro >= 0 ? isX(r[iSpiro]) : false,
        necessita_vesti: iVesti >= 0 ? isX(r[iVesti]) : false,
        necessita_erg: iErg >= 0 ? isX(r[iErg]) : false,
        necessita_etil: iEtil >= 0 ? isX(r[iEtil]) : false,
        necessita_td: iTd >= 0 ? isX(r[iTd]) : false,
        note_varie: iVarie >= 0 ? String(r[iVarie] || '').trim() || null : null,
        stato: 'non_arrivato',
        arrivato: false
      })
    }

    if (records.length === 0) {
      alert('Nessun paziente trovato nel foglio selezionato')
      return
    }

    const { error } = await supabase.from('pazienti_attesa').insert(records)
    if (error) alert('Errore importazione: ' + error.message)
    if (!error) caricaPazienti(sessione)
    e.target.value = ''
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
        <button
          onClick={svuotaLista}
          style={{
            background: '#fee2e2',
            color: '#dc2626',
            border: '1px solid #dc2626',
            borderRadius: 10,
            padding: '10px 20px',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: 14
          }}
        >
          🗑 Svuota lista
        </button>
      </div>

      <GestioneDocumenti onDocumentoSelezionato={setDocumentoAttivo} />

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
                <div style={{ fontSize: 13, color: '#888', marginBottom: 2 }}>
                  {p.orario_appuntamento || '—'}
                  {p.azienda && ` · 🏢 ${p.azienda}`}
                  {p.mansione && ` · 👷 ${p.mansione}`}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {p.necessita_ecg && <span style={{ background: '#fff3cd', color: '#856404', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>⚡ ECG</span>}
                  {p.necessita_prelievo && <span style={{ background: '#f8d7da', color: '#721c24', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>🩸 Prelievo</span>}
                  {p.necessita_audio && <span style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>🎧 Audio</span>}
                  {p.necessita_spiro && <span style={{ background: '#fce7f3', color: '#9d174d', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>💨 Spiro</span>}
                  {p.necessita_vesti && <span style={{ background: '#ede9fe', color: '#5b21b6', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>👗 Vesti</span>}
                  {p.necessita_erg && <span style={{ background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>🏋️ Erg</span>}
                  {p.necessita_etil && <span style={{ background: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>🍷 Etil</span>}
                  {p.necessita_td && <span style={{ background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>💉 TD</span>}
                  {p.note_varie && <span style={{ background: '#fef9c3', color: '#713f12', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>📝 {p.note_varie}</span>}
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
              <button
                onClick={() => window.open(`/firma?id=${p.id}&doc=${documentoAttivo?.id || ''}`, '_blank')}
                style={{
                  background: '#2d7d6f',
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
                ✍️ Firma
              </button>
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
