import { describe, expect, it } from 'vitest'
import { isSnapshotDue } from './snapshots'

const jan1Noon = Date.UTC(2026, 0, 1, 12, 0, 0)
const jan1Later = Date.UTC(2026, 0, 1, 23, 0, 0)
const jan2 = Date.UTC(2026, 0, 2, 0, 30, 0)

describe('isSnapshotDue', () => {
  it('is always due when there is no prior snapshot', () => {
    expect(isSnapshotDue(null, jan1Noon)).toBe(true)
  })

  it('is not due again later the same UTC day', () => {
    expect(isSnapshotDue(new Date(jan1Noon).toISOString(), jan1Later)).toBe(false)
  })

  it('is due once the UTC calendar day rolls over', () => {
    expect(isSnapshotDue(new Date(jan1Noon).toISOString(), jan2)).toBe(true)
  })

  it('force always writes, even within the same day', () => {
    expect(isSnapshotDue(new Date(jan1Noon).toISOString(), jan1Later, true)).toBe(
      true,
    )
  })
})
