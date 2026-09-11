import {
  BookOpen,
  FolderOpen,
  History,
  Home,
  Settings,
} from 'lucide-react'

const ITEMS = [
  { id: 'assessment', label: 'New Assessment', icon: Home },
  { id: 'history', label: 'Patient History', icon: History },
  { id: 'saved', label: 'Saved Cases', icon: FolderOpen },
  { id: 'resources', label: 'Resources', icon: BookOpen },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export function Sidebar({ activeItem = 'assessment', onNavigate }) {
  return (
    <aside className="mini-sidebar">
      <nav className="mini-nav">
        {ITEMS.map((item) => {
          const Icon = item.icon
          const active = activeItem === item.id
          return (
            <button
              key={item.id}
              type="button"
              className={`mini-link${active ? ' is-active' : ''}`}
              aria-current={active ? 'page' : undefined}
              onClick={() => onNavigate?.(item.id)}
            >
              <Icon size={16} strokeWidth={1.8} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
