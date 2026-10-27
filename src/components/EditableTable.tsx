import type { ReactNode } from 'react'

export interface Column<T> {
  key: string
  label: string
  read: (row: T) => string | number
  write: (row: T, value: string) => T
  type?: 'text' | 'number'
  num?: boolean
  width?: string
}

interface Props<T> {
  columns: Column<T>[]
  rows: T[]
  onChange: (rows: T[]) => void
  onAdd: () => void
  addLabel: string
  /** Extra per-row controls, rendered before the delete button. */
  rowActions?: (row: T, index: number) => ReactNode
  /** Extra classes per row; used to dim/filter curated-out rows. */
  rowClassName?: (row: T) => string
}

// Inline-editable table. Every cell is an input, so Tab / Shift+Tab navigate
// between cells natively (Excel-style); values commit on change.
export default function EditableTable<T>({
  columns,
  rows,
  onChange,
  onAdd,
  addLabel,
  rowActions,
  rowClassName,
}: Props<T>) {
  const update = (i: number, col: Column<T>, value: string) => {
    onChange(rows.map((r, j) => (j === i ? col.write(r, value) : r)))
  }
  const remove = (i: number) => {
    onChange(rows.filter((_, j) => j !== i))
  }

  return (
    <div>
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={c.num ? 'num' : ''} style={c.width ? { width: c.width } : undefined}>
                {c.label}
              </th>
            ))}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={rowClassName?.(row)}>
              {columns.map((col) => (
                <td key={col.key}>
                  <input
                    type={col.type ?? 'text'}
                    value={col.read(row) ?? ''}
                    onChange={(e) => update(i, col, e.target.value)}
                    style={col.num ? { maxWidth: 64, textAlign: 'right' } : undefined}
                  />
                </td>
              ))}
              <td className="row-actions">
                {rowActions?.(row, i)}
                <button className="small danger" onClick={() => remove(i)}>×</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="small" onClick={onAdd}>+ {addLabel}</button>
    </div>
  )
}
