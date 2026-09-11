import { useEffect, useMemo, useState } from 'react'

export function SearchSelect({
  id,
  value,
  onChange,
  options,
  placeholder = 'Search or select',
}) {
  const [query, setQuery] = useState(value || '')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setQuery(value || '')
  }, [value])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options.slice(0, 10)
    return options.filter((option) => option.toLowerCase().includes(q)).slice(0, 10)
  }, [options, query])

  return (
    <div className="search-select">
      <input
        id={id}
        className="control"
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          if (!e.target.value) onChange('')
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false)
            if (value) setQuery(value)
          }, 120)
        }}
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <ul className="med-suggestions">
          {matches.map((option) => (
            <li key={option}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setQuery(option)
                  onChange(option)
                  setOpen(false)
                }}
              >
                {option}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
