import { Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from './pages/HomePage.jsx'
import { AssessmentPage } from './pages/AssessmentPage.jsx'
import './App.css'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/assessment" element={<AssessmentPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
