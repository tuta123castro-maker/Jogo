import { format, isNegative, type Money } from '../lib/money'

/** Plain formatted money. */
export function MoneyText({ value }: { value: Money }) {
  return <span>{format(value)}</span>
}

/** P&L money, colored green/red, with an explicit + sign for gains. */
export function PnlText({ value }: { value: Money }) {
  const negative = isNegative(value)
  const sign = negative ? '' : '+'
  return (
    <span className={negative ? 'text-rose-400' : 'text-emerald-400'}>
      {sign}
      {format(value)}
    </span>
  )
}
