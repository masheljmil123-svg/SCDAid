import { ChevronDown, Moon, Sun, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { googleLoginUrl } from '../api/scdaidApi.js'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import logoLight from '../assets/scdaid-logo.png'
import logoDark from '../assets/scdaid-logo-dark.png'

const RESOURCE_LINKS = [
  { id: 'how', label: 'Clinical Guidelines' },
  { id: 'how', label: 'Pharmacogenomics' },
  { id: 'about', label: 'About SCDAid' },
]

export function Navbar({ onStart }) {
  const [resourcesOpen, setResourcesOpen] = useState(false)
  const [signInOpen, setSignInOpen] = useState(false)
  const menuRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggleTheme } = useTheme()
  const { user, authenticated, signOut } = useAuth()

  useEffect(() => {
    const onPointer = (event) => {
      if (!menuRef.current?.contains(event.target)) {
        setResourcesOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [])

  const handleStart = () => {
    if (onStart) {
      onStart()
      return
    }
    navigate('/assessment')
  }

  const goToSection = (id) => {
    setResourcesOpen(false)
    if (location.pathname !== '/') {
      navigate({ pathname: '/', hash: id })
      return
    }
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <header className="nav">
      <div className="nav-inner">
        <Link className="nav-brand" to="/">
          <img
            src={theme === 'dark' ? logoDark : logoLight}
            alt="SCDAid"
            className="nav-logo"
          />
        </Link>

        <nav className="nav-links" aria-label="Primary">
          <NavLink className={({ isActive }) => (isActive ? 'is-active' : undefined)} to="/" end>
            Home
          </NavLink>
          <button type="button" className="nav-text-btn" onClick={() => goToSection('about')}>
            About
          </button>
          <button type="button" className="nav-text-btn" onClick={() => goToSection('how')}>
            How It Works
          </button>
          <div className="nav-dropdown" ref={menuRef}>
            <button
              type="button"
              className="nav-dropdown-btn"
              aria-expanded={resourcesOpen}
              onClick={() => setResourcesOpen((open) => !open)}
            >
              Resources
              <ChevronDown size={14} />
            </button>
            {resourcesOpen && (
              <div className="nav-dropdown-menu">
                {RESOURCE_LINKS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => goToSection(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="nav-actions">
          <button
            type="button"
            className="nav-icon"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {authenticated ? (
            <div className="nav-account">
              {user.profile_picture ? (
                <img
                  className="nav-avatar"
                  src={user.profile_picture}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="nav-avatar nav-avatar--fallback" aria-hidden="true">
                  {(user.full_name || user.email || 'U').slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="nav-account-name">{user.full_name || user.email}</span>
              <button type="button" className="btn btn-outline" onClick={signOut}>
                Sign Out
              </button>
            </div>
          ) : (
            <button type="button" className="btn btn-outline" onClick={() => setSignInOpen(true)}>
              Sign In
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={handleStart}>
            Get Started
          </button>
        </div>
      </div>

      {signInOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setSignInOpen(false)}>
          <div
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="signin-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-close" aria-label="Close" onClick={() => setSignInOpen(false)}>
              <X size={16} />
            </button>
            <h2 id="signin-title">Sign In</h2>
            <p>Use your Google account to create or access your SCDAid account. Public signup is open.</p>
            <a className="btn btn-primary" href={googleLoginUrl()}>
              Continue with Google
            </a>
          </div>
        </div>
      )}
    </header>
  )
}

export { Navbar as default }
