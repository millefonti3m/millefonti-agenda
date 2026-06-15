import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Segreteria from './views/Segreteria'
import Infermeria from './views/Infermeria'
import Studio from './views/Studio'
import Display from './views/Display'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/segreteria" />} />
        <Route path="/segreteria" element={<Segreteria />} />
        <Route path="/infermeria" element={<Infermeria />} />
        <Route path="/studio/:numero" element={<Studio />} />
        <Route path="/display" element={<Display />} />
      </Routes>
    </BrowserRouter>
  )
}
