import { ResolvedColumnFilter } from '../features/Filters'
import { Row, RowData, RowModel, Table } from '../types'
import { memo } from '../utils'
import { filterRows } from './filterRowsUtils'

export function getPreGlobalFiltering<TData extends RowData>(): (
  table: Table<TData>
) => () => RowModel<TData> {
  return table =>
    memo(
      () => [
        table.getPreFilteredRowModel(),
        table.getState().columnFilters,
        table.getState().globalFilter,
      ],
      (rowModel, columnFilters, globalFilter) => {
        if (
          !rowModel.rows.length ||
          (!columnFilters?.length && !globalFilter)
        ) {
          for (let i = 0; i < rowModel.flatRows.length; i++) {
            rowModel.flatRows[i]!.columnFilters = {}
            rowModel.flatRows[i]!.columnFiltersMeta = {}
          }
          return rowModel
        }

        const resolvedColumnFilters: ResolvedColumnFilter<TData>[] = []

        ;(columnFilters ?? []).forEach(d => {
          const column = table.getColumn(d.id)

          if (!column) {
            if (process.env.NODE_ENV !== 'production') {
              console.warn(
                `Table: Could not find a column to filter with columnId: ${d.id}`
              )
            }
          }

          const filterFn = column.getFilterFn()

          if (!filterFn) {
            if (process.env.NODE_ENV !== 'production') {
              console.warn(
                `Could not find a valid 'column.filterFn' for column with the ID: ${column.id}.`
              )
            }
            return
          }

          resolvedColumnFilters.push({
            id: d.id,
            filterFn,
            resolvedValue: filterFn.resolveFilterValue?.(d.value) ?? d.value,
          })
        })

        const filterableIds = columnFilters.map(d => d.id)

        let currentColumnFilter

        // Flag the prefiltered row model with each filter state
        for (let j = 0; j < rowModel.flatRows.length; j++) {
          const row = rowModel.flatRows[j]!

          row.columnFilters = {}

          if (resolvedColumnFilters.length) {
            for (let i = 0; i < resolvedColumnFilters.length; i++) {
              currentColumnFilter = resolvedColumnFilters[i]!
              const id = currentColumnFilter.id

              // Tag the row with the column filter state
              row.columnFilters[id] = currentColumnFilter.filterFn(
                row,
                id,
                currentColumnFilter.resolvedValue,
                filterMeta => {
                  row.columnFiltersMeta[id] = filterMeta
                }
              )
            }
          }
        }

        const filterRowsImpl = (row: Row<TData>) => {
          // Horizontally filter rows through each column
          for (let i = 0; i < filterableIds.length; i++) {
            if (row.columnFilters[filterableIds[i]!] === false) {
              return false
            }
          }
          return true
        }

        // Filter final rows using all of the active filters
        return filterRows(rowModel.rows, filterRowsImpl, table)
      },
      {
        key: process.env.NODE_ENV === 'development' && 'getPreGlobalFiltering',
        debug: () => table.options.debugAll ?? table.options.debugTable,
        onChange: () => {
          table._autoResetPageIndex()
        },
      }
    )
}
