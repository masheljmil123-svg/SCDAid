import { useCallback, useEffect, useRef, useState } from 'react'
import { Navbar } from '../components/Navbar.jsx'
import { Sidebar } from '../components/Sidebar.jsx'
import { PatientAssessment } from '../components/PatientAssessment.jsx'
import { RecommendationResults } from '../components/RecommendationResults.jsx'
import { WorkspacePanel } from '../components/WorkspacePanel.jsx'
import {
  EMPTY_FORM,
  countCompletedSections,
  validateForm,
} from '../data/formState.js'
import { LOADING_STEPS, buildRecommendation } from '../data/recommendation.js'

export function AssessmentPage() {
  const [activePage, setActivePage] = useState('assessment')
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState(0)
  const [result, setResult] = useState(null)
  const timersRef = useRef([])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id))
    timersRef.current = []
  }, [])

  useEffect(() => () => clearTimers(), [clearTimers])

  const onChange = useCallback((name, value) => {
    setForm((current) => ({ ...current, [name]: value }))
    setErrors((current) => {
      if (!current[name]) return current
      const next = { ...current }
      delete next[name]
      return next
    })
  }, [])

  const resetAssessment = useCallback(() => {
    clearTimers()
    setForm(EMPTY_FORM)
    setErrors({})
    setResult(null)
    setLoading(false)
    setLoadingStep(0)
  }, [clearTimers])

  const onClear = useCallback(() => {
    setForm(EMPTY_FORM)
    setErrors({})
  }, [])

  const onNavigate = useCallback(
    (id) => {
      if (id === 'assessment') {
        resetAssessment()
      }
      setActivePage(id)
    },
    [resetAssessment],
  )

  const onSubmit = useCallback(() => {
    const nextErrors = validateForm(form)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    clearTimers()
    setResult(null)
    setLoading(true)
    setLoadingStep(0)

    const recommendationPromise = buildRecommendation(form)

    LOADING_STEPS.forEach((_, index) => {
      const id = window.setTimeout(async () => {
        if (index < LOADING_STEPS.length - 1) {
          setLoadingStep(index + 1)
          return
        }
        const nextResult = await recommendationPromise
        setResult(nextResult)
        setLoading(false)
      }, (index + 1) * 520)
      timersRef.current.push(id)
    })
  }, [clearTimers, form])

  const progress = countCompletedSections(form)

  return (
    <div className="page assessment-page">
      <Navbar />
      <section className="assessment-shell">
        <Sidebar activeItem={activePage} onNavigate={onNavigate} />
        {activePage === 'assessment' ? (
          <PatientAssessment
            form={form}
            errors={errors}
            progress={progress}
            loading={loading}
            onChange={onChange}
            onClear={onClear}
            onSubmit={onSubmit}
          />
        ) : (
          <WorkspacePanel view={activePage} />
        )}
        <RecommendationResults
          result={result}
          form={form}
          loading={loading}
          loadingStep={loadingStep}
        />
      </section>
    </div>
  )
}
