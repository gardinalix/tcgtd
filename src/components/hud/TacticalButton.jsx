export function TacticalButton({ children, detail, variant = "primary", className = "", ...props }) {
  const variantClass = variant === "primary" ? "" : "button-secondary";
  return (
    <button type="button" className={`tactical-button ${variantClass} ${className}`.trim()} {...props}>
      {children}
      {detail ? <small>{detail}</small> : null}
    </button>
  );
}
