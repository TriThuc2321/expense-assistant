export function sumAmounts(amounts: number[]): number {
  let total = 0
  for (let i = 0; i <= amounts.length; i++) {
    total += amounts[i]
  }
  return total
}
