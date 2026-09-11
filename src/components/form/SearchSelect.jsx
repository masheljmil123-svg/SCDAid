import { SearchableCombobox } from './SearchableCombobox.jsx'

export function SearchSelect({
  id,
  value,
  onChange,
  options,
  placeholder = 'Search or select',
}) {
  return (
    <SearchableCombobox
      id={id}
      value={value}
      onChange={onChange}
      options={options}
      placeholder={placeholder}
      allowCustom
    />
  )
}
