interface Props {
  active: 'today' | 'tasks' | 'people'
  onChange: (tab: 'today' | 'tasks' | 'people') => void
}

export default function BottomNav({ active, onChange }: Props) {
  return (
    <nav className="bottom-nav">
      <button className={active === 'today' ? 'nav-item active' : 'nav-item'} onClick={() => onChange('today')}>
        <span className="nav-icon">☀️</span>
        <span>Today</span>
      </button>
      <button className={active === 'tasks' ? 'nav-item active' : 'nav-item'} onClick={() => onChange('tasks')}>
        <span className="nav-icon">📋</span>
        <span>Tasks</span>
      </button>
      <button className={active === 'people' ? 'nav-item active' : 'nav-item'} onClick={() => onChange('people')}>
        <span className="nav-icon">👥</span>
        <span>People</span>
      </button>
    </nav>
  )
}
