import { useState, useRef, useMemo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

// DataTable masivo SECOP: TanStack Table + virtualizador (60 FPS)
// Design: Telemetry Tactico densas líneas 1px + mono, DENSITY 8
const columnHelper = createColumnHelper();

const columns = [
  columnHelper.accessor("id_contrato", {
    header: "ID contrato",
    cell: (info) => (
      <span className="truncate font-medium font-mono text-[12px]">{info.getValue()}</span>
    ),
    size: 180,
  }),
  columnHelper.accessor("contratista_nombre", {
    header: "Contratista",
    cell: (info) => <span className="truncate text-zinc-700 dark:text-zinc-300">{info.getValue() || "—"}</span>,
    size: 200,
  }),
  columnHelper.accessor("departamento", {
    header: "Depto",
    cell: (info) => <span className="truncate text-zinc-600 dark:text-zinc-400">{info.getValue()}</span>,
    size: 120,
  }),
  columnHelper.accessor("modalidad", {
    header: "Modalidad",
    cell: (info) => {
      const v = info.getValue() || "";
      const isDirecta = v.toLowerCase().includes("directa");
      return (
        <span
          className={`inline-flex px-2 py-0.5 rounded-full text-[11px] border font-medium ${
            isDirecta
              ? "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900"
              : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900"
          }`}
        >
          {v || "—"}
        </span>
      );
    },
    size: 160,
  }),
  columnHelper.accessor("valor_contrato", {
    header: "Valor",
    cell: (info) => {
      const v = info.getValue();
      return (
        <span className="font-mono text-[12px] tabular-nums">
          ${Number(v || 0).toLocaleString("es-CO")}
        </span>
      );
    },
    sortingFn: "basic",
    size: 140,
  }),
  columnHelper.accessor("fecha_firma", {
    header: "Fecha",
    cell: (info) => (
      <span className="font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
        {info.getValue() ? String(info.getValue()).slice(0, 10) : "—"}
      </span>
    ),
    size: 110,
  }),
];

export default function DataTableSECOP({ rows, isFetching, count }) {
  const [sorting, setSorting] = useState([]);
  const parentRef = useRef(null);

  const data = useMemo(() => rows, [rows]);
  const memoColumns = useMemo(() => columns, []);

  // TanStack Table retorna funciones no memoizables — React Compiler lo skippea intencionalmente
  // oxlint-disable-next-line react/incompatible-library
  const table = useReactTable({
    data,
    columns: memoColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const sortedRows = table.getRowModel().rows;

  const virtualizer = useVirtualizer({
    count: sortedRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 8,
  });

  // Sólida a propósito: blur sobre canvas animado = repaint por frame. Glass solo en header.
  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-[0_8px_32px_rgba(0,0,0,0.06)] p-4 sm:p-5 min-w-0 w-full overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">
          Contratos · DataTable masivo
        </h2>
        <span className="text-[11px] px-2 py-1 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-mono">
          {count ?? rows.length} totales
        </span>
      </div>
      <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 tabular-nums">
        Virtualizada: solo filas visibles al DOM · sorting por cabecera · 60 FPS
        {isFetching && " · actualizando..."}
      </p>

      <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-700">
        <div className="min-w-[910px]">
        <div className="grid grid-cols-[180px_200px_120px_160px_140px_110px] gap-0 bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-700 text-[11px] uppercase tracking-[0.14em] text-zinc-600 dark:text-zinc-400 font-medium">
          {table.getHeaderGroups()[0].headers.map((header) => (
            <button
              key={header.id}
              onClick={header.column.getToggleSortingHandler()}
              className="text-left px-3 py-2.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1"
            >
              {header.isPlaceholder
                ? null
                : flexRender(header.column.columnDef.header, header.getContext())}
              <span className="font-mono text-[11px]">
                {{ asc: "↑", desc: "↓" }[header.column.getIsSorted()] ?? "↕"}
              </span>
            </button>
          ))}
        </div>

        <div
          ref={parentRef}
          role="region"
          aria-label="Tabla de contratos"
          tabIndex={0}
          className="h-[320px] sm:h-[360px] overflow-auto bg-white dark:bg-zinc-900 focus-visible:ring-2 focus-visible:ring-emerald-600"
        >
          <div style={{ height: `${virtualizer.getTotalSize()}px`, position: "relative" }}>
            {virtualizer.getVirtualItems().map((v) => {
              const row = sortedRows[v.index];
              return (
                <div
                  key={row.id}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${v.start}px)`,
                  }}
                  className="h-[44px] grid grid-cols-[180px_200px_120px_160px_140px_110px] items-center px-0 border-b border-zinc-100 dark:border-zinc-800 text-xs divide-x divide-zinc-100 dark:divide-zinc-800"
                >
                  {row.getVisibleCells().map((cell) => (
                    <div key={cell.id} className="px-3 truncate">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        </div>
      </div>

      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2">
        Click en cabecera ordena · scroll no congela · exporta respeta filtro
      </p>
    </div>
  );
}
