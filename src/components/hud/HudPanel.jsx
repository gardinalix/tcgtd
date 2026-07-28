export function HudPanel({ as: Component = "section", className = "", title, children, ...props }) {
  return (
    <Component className={`hud-panel cockpit-panel ${className}`.trim()} {...props}>
      {title ? <span className="eyebrow">{title}</span> : null}
      {children}
    </Component>
  );
}
