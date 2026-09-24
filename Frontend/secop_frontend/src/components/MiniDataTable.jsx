import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { CaretDown, CaretLeft, CaretRight, CaretUp, CaretUpDown } from "@phosphor-icons/react";

// MiniDataTable — DataTable liviana para alertas (Banderas / Predominio).
// Qué: sorting por cabecera + paginación cliente (8 filas). Por qué: el backend
// devuelve la lista SIN tope; pintar 1.000+ filas de golpe congela el scroll.
// Uso: <MiniDataTable columns={cols} data={filas} defaultSort={[{ id: "pct", desc: true }]} />
export default function MiniDataTable({ columns, data, defaultSort, pageSize = 8, label }) {
  const memoData = useMemo(() => data ?? [], [data]);
  const memoCols = useMemo(() => columns, [columns]);

  // TanStack Table retorna funciones no memoizables — React Compiler lo skippea intencionalmente
  // oxlint-disable-next-line react/incompatible-library
  const table = useReactTable({
    data: memoData,
    columns: memoCols,
    initialState: {
      sorting: defaultSort ?? [],
      pagination: { pageIndex: 0, pageSize },
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;
  const rows = table.getRowModel().rows;
  // Alto idéntico en TODAS las páginas: filas de 45px + relleno hasta pageSize.
  // Sin esto la última página (con menos filas) encoge la tabla y salta el layout.
  const pageSizeActual = table.getState().pagination.pageSize;
  const relleno = Math.max(0, pageSizeActual - rows.length);

  return (
    <div className="mt-2 min-w-0">
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-sm min-w-[560px] table-fixed">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="bg-zinc-50/80 dark:bg-zinc-800/60">
                {hg.headers.map((h) => {
                  const align = h.column.columnDef.meta?.align ?? "left";
                  const width = h.column.columnDef.meta?.width;
                  const sorted = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      style={width ? { width } : undefined}
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
                      className={`py-2 px-3 h-[37px] text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium ${align === "right" ? "text-right" : "text-left"}`}
                    >
                      {h.isPlaceholder ? null : (
                        <button
                          type="button"
                          onClick={h.column.getToggleSortingHandler()}
                          title="Ordenar"
                          className={`inline-flex items-center gap-1 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors ${align === "right" ? "flex-row-reverse" : ""}`}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          <span aria-hidden="true" className="text-zinc-400">
                            {sorted === "asc" ? <CaretUp size={12} /> : sorted === "desc" ? <CaretDown size={12} /> : <CaretUpDown size={12} />}
                          </span>
                        </button>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="h-[45px] border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                {row.getVisibleCells().map((cell) => {
                  const align = cell.column.columnDef.meta?.align ?? "left";
                  const width = cell.column.columnDef.meta?.width;
                  const contenido = flexRender(cell.column.columnDef.cell, cell.getContext());
                  return (
                    <td
                      key={cell.id}
                      style={width ? { width } : undefined}
                      className={`py-2 px-3 ${align === "right" ? "text-right tabular-nums whitespace-nowrap" : ""}`}
                    >
                      {align === "right" ? (
                        contenido
                      ) : (
                        <span className="block truncate" title={String(cell.getValue() ?? "")}>
                          {contenido}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
            {Array.from({ length: relleno }).map((_, i) => (
              <tr key={`relleno-${i}`} aria-hidden="true" className="h-[45px] border-t border-zinc-100 dark:border-zinc-800">
                <td colSpan={memoCols.length} className="py-2 px-3 select-none">&nbsp;</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav aria-label={label ?? "Paginación de tabla"} className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums">
          Página {pageCount === 0 ? 0 : pageIndex + 1} de {pageCount} · {memoData.length} filas
        </p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label="Página anterior"
            className="h-7 w-7 grid place-items-center rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
          >
            <CaretLeft size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label="Página siguiente"
            className="h-7 w-7 grid place-items-center rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors"
          >
            <CaretRight size={14} aria-hidden="true" />
          </button>
        </div>
      </nav>
    </div>
  );
}
