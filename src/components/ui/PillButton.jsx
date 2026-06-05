/**
 * Full-width black pill button.
 * disabled → opacity 0.4 + pointer-events none (applied via inline style,
 * not the native :disabled selector, so the opacity drop is always visible).
 */
export default function PillButton({ children, onClick, disabled = false, style }) {
  return (
    <button
      className={`pill-btn${disabled ? '' : ' pill-btn--enabled'}`}
      onClick={disabled ? undefined : onClick}
      style={{
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        ...style,
      }}
    >
      {children}
    </button>
  );
}
