/**
 * Primitivas de UI.
 *
 * Componentes chicos y sin logica de negocio, para que las pantallas se lean
 * como una descripcion de la interfaz y no como una sopa de clases de
 * Tailwind repetidas.
 */
import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

type Tono = 'neutro' | 'rojo' | 'ambar' | 'verde' | 'marca';

const TONOS: Record<Tono, string> = {
  neutro: 'bg-slate-100 text-slate-700',
  rojo: 'bg-red-100 text-red-700',
  ambar: 'bg-amber-100 text-amber-700',
  verde: 'bg-emerald-100 text-emerald-700',
  marca: 'bg-marca-100 text-marca-700',
};

export function Badge({ children, tono = 'neutro' }: { children: ReactNode; tono?: Tono }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${TONOS[tono]}`}>
      {children}
    </span>
  );
}

export function Tarjeta({
  titulo,
  descripcion,
  acciones,
  children,
}: {
  titulo?: string;
  descripcion?: string;
  acciones?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="tarjeta p-5">
      {(titulo || acciones) && (
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            {titulo && <h2 className="font-bold">{titulo}</h2>}
            {descripcion && <p className="mt-0.5 text-sm text-slate-500">{descripcion}</p>}
          </div>
          {acciones}
        </header>
      )}
      {children}
    </section>
  );
}

/** Indicador de carga. Centrado y con altura minima para que no salte el layout. */
export function Cargando({ texto = 'Cargando...' }: { texto?: string }) {
  return (
    <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-slate-500">
      <Loader2 className="animate-spin" size={16} />
      {texto}
    </div>
  );
}

/** Mensaje de error de una operacion. */
export function MensajeError({ mensaje, detalles }: { mensaje: string; detalles?: unknown }) {
  // La API devuelve `details` como lista de { campo, mensaje } en los errores
  // de validacion; si viene en esa forma se muestra desglosada.
  const lista = Array.isArray(detalles)
    ? (detalles as { campo?: string; mensaje?: string }[])
    : null;

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <div className="flex items-center gap-2 font-semibold">
        <AlertCircle size={16} />
        {mensaje}
      </div>
      {lista && (
        <ul className="mt-2 list-inside list-disc space-y-0.5 text-red-700">
          {lista.map((d, i) => (
            <li key={i}>{d.mensaje ?? JSON.stringify(d)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Exito({ mensaje }: { mensaje: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
      <CheckCircle2 size={16} />
      {mensaje}
    </div>
  );
}

/** Estado vacio: explica que hacer, no solo que no hay nada. */
export function Vacio({ titulo, detalle }: { titulo: string; detalle?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
      <p className="font-semibold text-slate-600">{titulo}</p>
      {detalle && <p className="mt-1 text-sm text-slate-400">{detalle}</p>}
    </div>
  );
}

/** Tarjeta de indicador del tablero. */
export function Kpi({
  etiqueta,
  valor,
  tono = 'marca',
}: {
  etiqueta: string;
  valor: string | number;
  tono?: Tono;
}) {
  const barra: Record<Tono, string> = {
    neutro: 'bg-slate-300',
    rojo: 'bg-red-400',
    ambar: 'bg-amber-400',
    verde: 'bg-emerald-400',
    marca: 'bg-marca-500',
  };

  return (
    <div className="tarjeta p-5">
      <p className="text-sm text-slate-500">{etiqueta}</p>
      <p className="mt-2 text-3xl font-bold">{valor}</p>
      <div className={`mt-4 h-1.5 rounded-full ${barra[tono]}`} />
    </div>
  );
}

/** Barras horizontales simples. Sin libreria de graficos: son cuatro divs. */
export function BarrasHorizontales({
  datos,
}: {
  datos: { etiqueta: string; valor: number }[];
}) {
  const maximo = Math.max(1, ...datos.map((d) => d.valor));

  return (
    <div className="space-y-3">
      {datos.map((d) => (
        <div
          key={d.etiqueta}
          className="grid grid-cols-[68px_1fr_28px] items-center gap-2 sm:grid-cols-[100px_1fr_32px] sm:gap-3"
        >
          <span className="truncate text-sm capitalize text-slate-600" title={d.etiqueta}>
            {d.etiqueta}
          </span>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-3 rounded-full bg-marca-500 transition-all"
              style={{ width: `${(d.valor / maximo) * 100}%` }}
            />
          </div>
          <b className="text-right text-sm">{d.valor}</b>
        </div>
      ))}
    </div>
  );
}
