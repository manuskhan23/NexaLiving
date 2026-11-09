export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}
export function rangeFilter(startField: string, endField: string, from: Date, to: Date) {
  return { [startField]: { $lt: to }, [endField]: { $gt: from } } as Record<string, any>;
}