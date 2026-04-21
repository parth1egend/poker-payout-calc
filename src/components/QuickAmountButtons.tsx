interface QuickAmountButtonsProps {
  amounts: number[];
  onPick: (value: number) => void;
}

export const QuickAmountButtons = ({ amounts, onPick }: QuickAmountButtonsProps) => (
  <div className="chip-row">
    {amounts.map((amount) => (
      <button key={amount} type="button" className="chip-button" onClick={() => onPick(amount)}>
        +{amount}
      </button>
    ))}
  </div>
);
