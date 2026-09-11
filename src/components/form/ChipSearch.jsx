import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'

export function ChipSearch({
  id,
  values,
  onChange,
  suggestions = [],
  placeholder = 'Search or type, then press Enter',
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    const unused = suggestions.filter(
      (name) => !values.some((item) => item.toLowerCase() === name.toLowerCase()),
    )
    if (!q) return unused.slice(0, 6)
    return unused.filter((name) => name.toLowerCase().includes(q)).slice(0, 8)
  }, [query, suggestions, values])

  const addValue = (raw) => {
    const name = raw.trim()
    if (!name) return
    if (!values.some((item) => item.toLowerCase() === name.toLowerCase())) {
      onChange([...values, name])
    }
    setQuery('')
    setOpen(false)
  }

  return (
    <div>
      <div className="med-search">
        <Search size={14} className="med-search-icon" />
        <input
          id={id}
          className="control med-search-input"
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addValue(query)
            }
          }}
          autoComplete="off"
        />
        {open && matches.length > 0 && (
          <ul className="med-suggestions">
            {matches.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addValue(name)}
                >
                  {name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {values.length > 0 && (
        <ul className="chip-list">
          {values.map((name) => (
            <li key={name} className="chip">
              <span>{name}</span>
              <button
                type="button"
                aria-label={`Remove ${name}`}
                onClick={() => onChange(values.filter((item) => item !== name))}
              >
                <X size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
