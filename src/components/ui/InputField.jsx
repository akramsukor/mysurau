/**
 * 56px tall text input with optional label.
 * Fill: #000 @ 4% (focused: 8%). Placeholder: #000 @ 24%.
 */
export default function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  id,
  ...rest
}) {
  return (
    <div className="input-field">
      {label && (
        <label className="input-field__label" htmlFor={id}>
          {label}
        </label>
      )}
      <input
        id={id}
        className="input-field__input"
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        {...rest}
      />
    </div>
  );
}
