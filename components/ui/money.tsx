import { formatMoney, toNumber, type NumericLike } from "@/lib/format";

/**
 * Money always renders mono and tabular so columns of figures line up on the decimal.
 * `colorNegative` is for variance columns, which the spec colours only when negative.
 */
export function Money({
  amount,
  signed = false,
  colorNegative = false,
  className = "",
}: {
  amount: NumericLike;
  signed?: boolean;
  colorNegative?: boolean;
  className?: string;
}) {
  const n = toNumber(amount);
  const negative = n !== null && n < 0;
  return (
    <span
      className={`block text-right font-mono tabular-nums ${
        colorNegative && negative ? "text-danger" : ""
      } ${className}`}
    >
      {formatMoney(amount, { signed })}
    </span>
  );
}
