/**
 * Un desvio presentado como tarjeta, para pantallas angostas.
 *
 * La tabla de registros tiene columnas dinamicas: cuantas haya depende de
 * cuantos campos marque el administrador con `showInTable`, asi que su ancho
 * no tiene techo. En un telefono eso es scroll horizontal infinito. Esta
 * tarjeta muestra lo mismo apilado: etiqueta arriba, valor abajo.
 */
import { Trash2 } from 'lucide-react';
import { Badge } from '../../components/ui';
import { ValorCampo } from './ValorCampo';
import type { CampoFormulario, Desvio } from '../../types';

export function TarjetaDesvio({
  desvio,
  columnas,
  campoImpacto,
  onEliminar,
}: {
  desvio: Desvio;
  /** Campos visibles, los mismos que arman las columnas de la tabla. */
  columnas: CampoFormulario[];
  campoImpacto: CampoFormulario | undefined;
  /** undefined = el usuario no puede eliminar; no se dibuja el boton. */
  onEliminar?: (id: string) => void;
}) {
  return (
    <article className="border-t border-slate-100 p-4 first:border-t-0">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-marca-700">{desvio.code}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Ocurrio {desvio.occurredOn} · Levantado {desvio.raisedOn}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge tono={desvio.diasHastaDeteccion > 1 ? 'rojo' : 'verde'}>
            {desvio.diasHastaDeteccion} dia/s
          </Badge>
          {onEliminar && (
            <button
              onClick={() => onEliminar(desvio.id)}
              className="p-1 text-slate-400 transition hover:text-red-600"
              title="Eliminar desvio"
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </header>

      {columnas.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 text-sm">
          {columnas.map((columna) => (
            <div key={columna.id} className="min-w-0">
              <dt className="truncate text-xs text-slate-400">{columna.label}</dt>
              <dd className="mt-0.5 break-words font-medium">
                <ValorCampo
                  valor={desvio.values[columna.key]}
                  esImpacto={campoImpacto?.key === columna.key}
                />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </article>
  );
}
