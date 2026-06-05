/**
 * iOS-style toggle.
 * 52 × 32px capsule, 24px white knob.
 * on  → brand teal #008CB3
 * off → iOS systemGray3 #C7C7CC
 * Knob transition uses a spring cubic-bezier for the characteristic iOS overshoot.
 */
export default function Toggle({ on, onChange }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      className={`toggle${on ? ' toggle--on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <span className="toggle__knob" />
    </button>
  );
}
