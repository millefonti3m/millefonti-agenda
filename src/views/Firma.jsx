import { useRef, useState, useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import SignatureCanvas from 'react-signature-canvas'
import { supabase } from '../supabase'
import * as pdfjsLib from 'pdfjs-dist'
pdfjsLib.GlobalWorkerOptions.workerSrc =
  `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`

const VERDE = '#255736'
const TEAL = '#2d7d6f'

export default function Firma() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const sigRef = useRef(null)
  const canvasRef = useRef(null)
  const [paziente, setPaziente] = useState(null)
  const [documento, setDocumento] = useState(null)
  const [pagine, setPagine] = useState([])
  const [salvando, setSalvando] = useState(false)
  const [completato, setCompletato] = useState(false)
  const [caricandoPdf, setCaricandoPdf] = useState(false)

  const pazienteId = searchParams.get('id')
  const docId = searchParams.get('doc')

  // Carica paziente
  useEffect(() => {
    if (!pazienteId) return
    supabase.from('pazienti_attesa')
      .select('*').eq('id', pazienteId).single()
      .then(({ data }) => setPaziente(data))
  }, [pazienteId])

  // Carica documento
  useEffect(() => {
    const caricaDoc = async () => {
      let doc = null
      if (docId) {
        const { data } = await supabase
          .from('documenti_firma')
          .select('*').eq('id', docId).single()
        doc = data
      } else {
        const { data } = await supabase
          .from('documenti_firma')
          .select('*').eq('predefinito', true).eq('attivo', true).single()
        doc = data
      }
      if (doc) {
        setDocumento(doc)
        renderPDF(doc.url_pdf)
      }
    }
    caricaDoc()
  }, [docId])

  // Renderizza PDF come immagini
  const renderPDF = async (url) => {
    setCaricandoPdf(true)
    try {
      const pdf = await pdfjsLib.getDocument(url).promise
      const imgs = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const viewport = page.getViewport({ scale: 1.5 })
        const canvas = document.createElement('canvas')
        canvas.width = viewport.width
        canvas.height = viewport.height
        await page.render({
          canvasContext: canvas.getContext('2d'),
          viewport
        }).promise
        imgs.push(canvas.toDataURL('image/jpeg', 0.85))
      }
      setPagine(imgs)
    } catch(e) {
      console.error('Errore PDF:', e)
    }
    setCaricandoPdf(false)
  }

  const pulisci = () => sigRef.current?.clear()

  const salva = async () => {
    if (!sigRef.current || sigRef.current.isEmpty()) {
      alert('Per favore firmare prima di confermare')
      return
    }
    setSalvando(true)
    try {
      const firmaBase64 = sigRef.current.toDataURL('image/png')

      // Salva firma in DB
      await supabase.from('pazienti_attesa')
        .update({
          firma_digitale: firmaBase64,
          documento_firma_id: documento?.id || null
        })
        .eq('id', pazienteId)

      setCompletato(true)
      setTimeout(() => navigate('/'), 3000)
    } catch(e) {
      console.error('Errore salvataggio:', e)
    }
    setSalvando(false)
  }

  if (completato) return (
    <div style={{
      minHeight: '100vh',
      background: '#f0f5f0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'Arial, sans-serif',
      textAlign: 'center'
    }}>
      <img src="/logo_transparent.png" alt="logo"
        style={{ height: 120, marginBottom: 32 }} />
      <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
      <div style={{ color: VERDE, fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
        Firma acquisita
      </div>
      <div style={{ color: '#888', fontSize: 18 }}>
        Grazie, si accomodi in sala d'attesa
      </div>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f0f5f0',
      fontFamily: 'Arial, sans-serif',
      padding: 24,
      maxWidth: 700,
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <img src="/logo_transparent.png" alt="logo"
          style={{ height: 80, marginBottom: 12 }} />
        {paziente && (
          <div style={{ color: '#888', fontSize: 15 }}>
            {paziente.nome} — N° {paziente.numero_progressivo}
          </div>
        )}
        {documento && (
          <div style={{ color: VERDE, fontSize: 16, fontWeight: 700, marginTop: 4 }}>
            {documento.nome}
          </div>
        )}
      </div>

      {/* PDF viewer */}
      {caricandoPdf && (
        <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>
          ⏳ Caricamento documento...
        </div>
      )}

      {pagine.map((img, i) => (
        <img
          key={i}
          src={img}
          alt={`Pagina ${i+1}`}
          style={{
            width: '100%',
            borderRadius: 8,
            marginBottom: 8,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
          }}
        />
      ))}

      {!caricandoPdf && pagine.length === 0 && (
        <div style={{
          background: 'white',
          borderRadius: 14,
          padding: 32,
          textAlign: 'center',
          color: '#888',
          marginBottom: 24
        }}>
          Nessun documento da visualizzare
        </div>
      )}

      {/* Area firma */}
      <div style={{
        background: 'white',
        borderRadius: 20,
        padding: 24,
        marginTop: 16,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
      }}>
        <div style={{
          color: VERDE,
          fontWeight: 700,
          fontSize: 16,
          marginBottom: 8
        }}>
          ✍️ Firma qui sotto
        </div>
        <div style={{ color: '#888', fontSize: 13, marginBottom: 12 }}>
          Firmando dichiaro di aver letto e compreso il documento sopra
        </div>
        <div style={{
          border: '2px solid #dde5f0',
          borderRadius: 12,
          overflow: 'hidden',
          marginBottom: 16,
          background: '#fafafa'
        }}>
          <SignatureCanvas
            ref={sigRef}
            canvasProps={{
              width: 620,
              height: 180,
              style: {
                display: 'block',
                touchAction: 'none',
                width: '100%',
                height: 180
              }
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
            {salvando ? '⏳ Salvataggio...' : '✅ Conferma e firma'}
          </button>
        </div>
      </div>
    </div>
  )
}
