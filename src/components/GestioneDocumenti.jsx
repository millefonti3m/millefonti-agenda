import { useEffect, useState } from 'react'
import { supabase } from '../supabase'

const VERDE = '#255736'
const TEAL = '#2d7d6f'

export default function GestioneDocumenti({ onDocumentoSelezionato }) {
  const [documenti, setDocumenti] = useState([])
  const [caricando, setCaricando] = useState(false)
  const [predefinito, setPredefinito] = useState(null)

  const caricaDocumenti = async () => {
    const { data } = await supabase
      .from('documenti_firma')
      .select('*')
      .eq('attivo', true)
      .order('created_at', { ascending: false })
    if (data) {
      setDocumenti(data)
      const pred = data.find(d => d.predefinito)
      if (pred) setPredefinito(pred.id)
    }
  }

  const uploadDocumento = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setCaricando(true)
    const sanitize = (name) => name
      .normalize('NFKD')
      .replace(/[̀-ͯ؀-ۿ​-‍﻿]/g, '')
      .replace(/[^a-zA-Z0-9._\-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
    const fileName = `${Date.now()}_${sanitize(file.name)}`
    const { error } = await supabase.storage
      .from('documenti-firma')
      .upload(fileName, file)
    if (!error) {
      const { data: urlData } = supabase.storage
        .from('documenti-firma')
        .getPublicUrl(fileName)
      await supabase.from('documenti_firma').insert({
        nome: file.name.replace('.pdf', ''),
        url_pdf: urlData.publicUrl,
        attivo: true,
        predefinito: documenti.length === 0
      })
      caricaDocumenti()
    }
    setCaricando(false)
  }

  const impostaPredefinito = async (id) => {
    await supabase.from('documenti_firma')
      .update({ predefinito: false })
      .neq('id', id)
    await supabase.from('documenti_firma')
      .update({ predefinito: true })
      .eq('id', id)
    setPredefinito(id)
  }

  const eliminaDocumento = async (id) => {
    await supabase.from('documenti_firma')
      .update({ attivo: false })
      .eq('id', id)
    caricaDocumenti()
  }

  useEffect(() => { caricaDocumenti() }, [])

  return (
    <div style={{
      background: 'white',
      borderRadius: 14,
      padding: 20,
      marginBottom: 20,
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
      }}>
        <div style={{ color: VERDE, fontWeight: 700, fontSize: 16 }}>
          📄 Documenti consenso
        </div>
        <label style={{
          background: VERDE,
          color: 'white',
          borderRadius: 8,
          padding: '8px 16px',
          fontWeight: 700,
          cursor: 'pointer',
          fontSize: 13
        }}>
          {caricando ? '⏳ Caricamento...' : '+ Carica PDF'}
          <input
            type="file"
            accept=".pdf"
            onChange={uploadDocumento}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {documenti.length === 0 && (
        <div style={{ color: '#888', fontSize: 14 }}>
          Nessun documento caricato
        </div>
      )}

      {documenti.map(d => (
        <div key={d.id} style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 0',
          borderBottom: '1px solid #f0f4f8'
        }}>
          <div style={{ flex: 1, fontSize: 14, color: '#333' }}>
            📄 {d.nome}
            {d.predefinito && (
              <span style={{
                marginLeft: 8,
                background: '#d4edda',
                color: '#155724',
                padding: '2px 8px',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 700
              }}>predefinito</span>
            )}
          </div>
          <button
            onClick={() => onDocumentoSelezionato(d)}
            style={{
              background: TEAL,
              color: 'white',
              border: 'none',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Usa
          </button>
          <button
            onClick={() => impostaPredefinito(d.id)}
            disabled={d.predefinito}
            style={{
              background: d.predefinito ? '#e2e8f0' : 'white',
              color: d.predefinito ? '#888' : VERDE,
              border: `1px solid ${d.predefinito ? '#e2e8f0' : VERDE}`,
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: d.predefinito ? 'default' : 'pointer'
            }}
          >
            ⭐ Default
          </button>
          <button
            onClick={() => eliminaDocumento(d.id)}
            style={{
              background: '#fff0f0',
              color: '#dc2626',
              border: 'none',
              borderRadius: 6,
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            🗑
          </button>
        </div>
      ))}
    </div>
  )
}
