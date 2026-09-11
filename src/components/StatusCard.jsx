export function StatusCard({ tone = 'neutral', icon: Icon, title, children }) {
  return (
    <article className={`status-card status-card--${tone}`}>
      <h3>
        {Icon ? (
          <span className="status-icon">
            <Icon size={13} strokeWidth={2.2} />
          </span>
        ) : null}
        {title}
      </h3>
      <p>{children}</p>
    </article>
  )
}
