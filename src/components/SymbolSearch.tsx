import { useState } from 'react'
import { useSymbolSearch } from '../lib/useSymbolSearch'

/**
 * Symbol lookup field: a plain text input that also drives a debounced
 * typeahead dropdown. Users can either pick a suggestion or press Enter with
 * whatever they typed — EODHD's search doesn't cover every listing, so a raw
 * symbol must still work even with no matches.
 */
export function SymbolSearch({
  onSelect,
  placeholder = 'AAPL.US or "apple"',
}: {
  onSelect: (symbol: string) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')
  const [open, setOpen] = useState(false)
  const { results, loading } = useSymbolSearch(input)

  function commit(symbol: string) {
    onSelect(symbol.trim().toUpperCase())
    setInput('')
    setOpen(false)
  }

  return (
    <div className="relative flex-1">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && input.trim()) commit(input)
            if (e.key === 'Escape') setOpen(false)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          className="flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-sky-500"
        />
        <button
          type="button"
          onClick={() => input.trim() && commit(input)}
          className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          Look up
        </button>
      </div>

      {open && input.trim().length >= 2 ? (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-lg">
          {loading ? (
            <li className="px-3 py-2 text-xs text-slate-500">Searching…</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-xs text-slate-500">
              No matches — press Enter to look up “{input.trim().toUpperCase()}” anyway.
            </li>
          ) : (
            results.map((r) => (
              <li key={r.symbol}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(r.symbol)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-800"
                >
                  <span>
                    <span className="font-medium text-slate-100">{r.symbol}</span>{' '}
                    <span className="text-slate-400">{r.name}</span>
                  </span>
                  <span className="text-xs text-slate-500">{r.currency}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  )
}
