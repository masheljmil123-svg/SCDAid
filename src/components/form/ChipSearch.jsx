import { SearchableCombobox } from './SearchableCombobox.jsx'

export function ChipSearch({
  id,
  values,
  onChange,
  suggestions = [],
  placeholder = 'Search or type, then press Enter',
}) {
  return (
    <SearchableCombobox
      id={id}
      multiple
      allowCustom
      values={values}
      onChange={onChange}
      options={suggestions}
      placeholder={placeholder}
    />
  )
}
