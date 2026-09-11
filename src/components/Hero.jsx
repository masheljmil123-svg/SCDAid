import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Cpu,
  Dna,
  User,
} from 'lucide-react'
import bloodBg from '../assets/scdaid-bg.png'

const FEATURES = [
  { icon: BookOpen, title: 'Evidence-Based', line: 'Guidelines' },
  { icon: Dna, title: 'Pharmacogenomics', line: '(CYP2D6)' },
  { icon: Cpu, title: 'AI-Powered', line: 'Recommendations' },
]

const CHECKS = [
  'Clinical safety checks',
  'Genetic considerations',
  'Predicted treatment response',
  'Proof-of-concept ranking',
]

export function Hero({ onStart, onLearn }) {
  return (
    <section className="hero" id="home">
      <div
        className="hero-cells"
        aria-hidden="true"
        style={{ backgroundImage: `url(${bloodBg})` }}
      />
      <div className="hero-cells-depth" aria-hidden="true">
        <span className="hero-blob hero-blob-a" />
        <span className="hero-blob hero-blob-b" />
        <span className="hero-blob hero-blob-c" />
      </div>

      <div className="hero-inner">
        <div className="hero-copy">
          <p className="hero-eyebrow">Clinical Decision Support</p>
          <h1 className="hero-title">
            <span>Smarter Opioid Decisions.</span>
            <span className="hero-title-red">Better Care for Sickle Cell.</span>
          </h1>
          <p className="hero-lead">
            SCDAid is a clinical decision-support tool that integrates
            patient-specific data, pharmacogenomics, and AI to help guide
            individualized opioid selection for vaso-occlusive crisis (VOC) in
            adults with sickle cell disease.
          </p>

          <div className="hero-cta">
            <button type="button" className="btn btn-primary btn-lg" onClick={onStart}>
              Start Patient Assessment
              <ArrowRight size={16} />
            </button>
            <button type="button" className="btn btn-outline btn-lg" onClick={onLearn}>
              Learn More
            </button>
          </div>

          <ul className="hero-features">
            {FEATURES.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.title}>
                  <span className="hero-feature-icon">
                    <Icon size={18} />
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <em>{item.line}</em>
                  </span>
                </li>
              )
            })}
          </ul>

          <p className="hero-tag">Safer decisions. Stronger tomorrows.</p>
        </div>

        <aside className="hero-card">
          <p className="hero-script">
            From data
            <br />
            to better days
          </p>

          <button type="button" className="hero-rec-strip" onClick={onStart}>
            <span className="hero-rec-icon">
              <User size={18} />
            </span>
            <span>
              Individualized
              <strong>Opioid Recommendation</strong>
            </span>
            <ChevronRight size={18} />
          </button>

          <ul className="hero-checks">
            {CHECKS.map((label) => (
              <li key={label}>
                <span>
                  <Check size={12} strokeWidth={3} />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <p className="hero-corner" aria-hidden="true">
        Sickle cell awareness
        <br />
        A healthier tomorrow
      </p>
    </section>
  )
}
