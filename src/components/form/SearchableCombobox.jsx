import { ChevronDown, X } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'

function sameValue(a, b) {
  return String(a).trim().toLowerCase() === String(b).trim().toLowerCase()
}

export function SearchableCombobox({
  id,
  value = '',
  values,
  onChange,
  options = [],
  placeholder = 'Search or select',
  multiple = false,
  allowCustom = true,
  disabled = false,
}) {
  const selected = multiple ? values ?? [] : []
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(multiple ? '' : value || '')
  const [activeIndex, setActiveIndex] = useState(0)
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const listId = useId()

  useEffect(() => {
    if (!multiple) setQuery(value || '')
  }, [multiple, value])

  const available = useMemo(() => {
    if (!multiple) return options
    return options.filter((option) => !selected.some((item) => sameValue(item, option)))
  }, [multiple, options, selected])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return available
    return available.filter((option) => option.toLowerCase().includes(needle))
  }, [available, query])

  const trimmed = query.trim()
  const showCustom = Boolean(
    allowCustom &&
      trimmed &&
      !filtered.some((option) => sameValue(option, trimmed)) &&
      !(multiple && selected.some((item) => sameValue(item, trimmed))) &&
      !( !multiple && value && sameValue(value, trimmed)),
  )

  const items = showCustom ? [...filtered, trimmed] : filtered

  useEffect(() => {
    if (!open) return undefined
    const onPointer = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false)
        if (multiple) setQuery('')
        else setQuery(value || '')
      }
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [multiple, open, value])

  useEffect(() => {
    setActiveIndex(0)
  }, [query, open])

  const commit = (raw) => {
    const next = String(raw || '').trim()
    if (!next) return
    if (multiple) {
      if (!selected.some((item) => sameValue(item, next))) {
        onChange([...selected, next])
      }
      setQuery('')
      setActiveIndex(0)
      return
    }
    onChange(next)
    setQuery(next)
    setOpen(false)
  }

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((index) => Math.min(index + 1, Math.max(items.length - 1, 0)))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((index) => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      if (!multiple) setQuery(value || '')
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      if (open && items[activeIndex]) {
        commit(items[activeIndex])
        return
      }
      if (allowCustom && trimmed) commit(trimmed)
    }
  }

  return (
    <div className={`combo${multiple ? ' combo--multiple' : ''}`} ref={rootRef}>
      <div className="combo-control">
        <input
          id={id}
          ref={inputRef}
          className="control combo-input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder={placeholder}
          value={query}
          disabled={disabled}
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
            if (!multiple && !event.target.value) onChange('')
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <button
          type="button"
          className="combo-toggle"
          tabIndex={-1}
          aria-label="Toggle options"
          disabled={disabled}
          onClick={() => {
            setOpen((current) => !current)
            inputRef.current?.focus()
          }}
        >
          <ChevronDown size={16} />
        </button>
      </div>
      {open && items.length > 0 && (
        <ul className="combo-menu" id={listId} role="listbox">
          {items.map((option, index) => {
            const isCustom = showCustom && index === items.length - 1 && option === trimmed
            return (
              <li key={`${option}-${index}`} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={`combo-option${index === activeIndex ? ' is-active' : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => commit(option)}
                >
                  {isCustom ? `Use “${option}”` : option}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {multiple && selected.length > 0 && (
        <ul className="chip-list">
          {selected.map((name) => (
            <li key={name} className="chip">
              <span>{name}</span>
              <button
                type="button"
                aria-label={`Remove ${name}`}
                onClick={() => onChange(selected.filter((item) => item !== name))}
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
