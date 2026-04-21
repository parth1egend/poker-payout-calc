interface MoneyFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  helpText?: string;
  placeholder?: string;
}

export const MoneyField = ({ label, value, onChange, helpText, placeholder }: MoneyFieldProps) => (
  <label className="field">
    <span>{label}</span>
    <input
      inputMode="decimal"
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
    {helpText ? <small>{helpText}</small> : null}
  </label>
);
