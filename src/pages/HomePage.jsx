import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Navbar } from '../components/Navbar.jsx'
import { Hero } from '../components/Hero.jsx'
import { InfoSection } from '../components/InfoSection.jsx'

export function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()

  const goToAssessment = () => {
    navigate('/assessment')
  }

  const scrollToHow = () => {
    document.getElementById('how')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    const id = location.hash.replace('#', '')
    if (!id) return
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [location.hash])

  return (
    <div className="page">
      <Navbar onStart={goToAssessment} />
      <Hero onStart={goToAssessment} onLearn={scrollToHow} />
      <InfoSection />
    </div>
  )
}
