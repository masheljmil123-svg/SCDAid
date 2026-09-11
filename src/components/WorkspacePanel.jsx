import { useTheme } from '../context/ThemeContext.jsx'

const RESOURCE_ITEMS = [
  { title: 'Clinical Guidelines', detail: 'NHLBI, ASH, and VOC analgesia references for clinician review.' },
  { title: 'Pharmacogenomics', detail: 'CYP2D6 activity, phenoconversion, and inhibitor screening notes.' },
  { title: 'About SCDAid', detail: 'A clinician-facing decision-support prototype for adult sickle cell VOC care.' },
]

export function WorkspacePanel({ view }) {
  const { theme, setTheme } = useTheme()

  if (view === 'history') {
    return (
      <div className="placeholder workspace-view">
        <h1>Patient History</h1>
        <p>No previous patient assessments yet.</p>
      </div>
    )
  }

  if (view === 'saved') {
    return (
      <div className="placeholder workspace-view">
        <h1>Saved Cases</h1>
        <p>No saved cases yet.</p>
      </div>
    )
  }

  if (view === 'resources') {
    return (
      <div className="placeholder workspace-view">
        <h1>Resources</h1>
        <p>Reference material for this prototype. External links will be added later.</p>
        <ul className="workspace-list">
          {RESOURCE_ITEMS.map((item) => (
            <li key={item.title}>
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (view === 'settings') {
    return (
      <div className="placeholder workspace-view">
        <h1>Settings</h1>
        <div className="settings-block">
          <div>
            <h2>Appearance</h2>
            <p>Choose how SCDAid looks on this device. The preference is saved locally.</p>
          </div>
          <div className="theme-switch" role="group" aria-label="Appearance">
            <button
              type="button"
              className={theme === 'light' ? 'is-on' : ''}
              aria-pressed={theme === 'light'}
              onClick={() => setTheme('light')}
            >
              Light
            </button>
            <button
              type="button"
              className={theme === 'dark' ? 'is-on' : ''}
              aria-pressed={theme === 'dark'}
              onClick={() => setTheme('dark')}
            >
              Dark
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
