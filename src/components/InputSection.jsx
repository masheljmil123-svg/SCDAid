import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const REQUIREMENT_LABELS = {
  required: 'Required',
  optional: 'Optional',
  conditional: 'Conditional',
}

export function InputSection({
  index,
  title,
  requirement,
  helper,
  defaultOpen = true,
  children,
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className={`input-section${open ? ' is-open' : ''}`}>
      <header className="input-section-head">
        <button
          type="button"
          className="input-section-toggle"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
        >
          <h2>
            {index}. {title}
          </h2>
          {requirement && (
            <span className={`req-badge req-badge--${requirement}`}>
              {REQUIREMENT_LABELS[requirement] || requirement}
            </span>
          )}
          <ChevronDown size={15} className="input-section-chevron" />
        </button>
        {helper && open && <p className="input-section-helper">{helper}</p>}
      </header>
      {open && <div className="input-section-body">{children}</div>}
    </section>
  )
}
