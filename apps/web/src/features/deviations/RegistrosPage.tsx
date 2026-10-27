/**
 * Listado de desvios.
 *
 * Las columnas tambien son dinamicas: se arman con los campos marcados como
 * `showInTable`. Filtros y paginado se resuelven en el servidor, asi la tabla
 * sigue andando con miles de registros.
 *
 * Se renderizan dos vistas de los mismos datos y el CSS elige una:
 *   < lg  -> tarjetas apiladas (TarjetaDesvio)
 *   >= lg -> tabla
 * El corte esta en lg (1024px) y no en md porque la tabla pide 900px minimo:
 * en una tablet vertical entraria, pero scrolleando de costado.
 * No es duplicacion: una tabla de N columnas dinamicas no entra en un
 * telefono, y el scroll horizontal esconde justamente la columna que importa.
 */
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useCampos, useDesvios, useEliminarDesvio } from '../../lib/queries';
import { Badge, BotonBorrar, Cargando, MensajeError, Vacio } from '../../components/ui';
import { TarjetaDesvio } from './TarjetaDesvio';
import { ValorCampo } from './ValorCampo';

export function RegistrosPage() {
  const { puede } = useAuth();
  const { data: campos } = useCampos();
  const eliminar = useEliminarDesvio();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  /** Texto efectivo de busqueda: se aplica al soltar Enter o al tipear. */
  const [busqueda, setBusqueda] = useState('');

  const { data, isLoading, error } = useDesvios({ page, pageSize: 25, search: busqueda });

  const columnas = (campos ?? []).filter((c) => c.showInTable);
  const campoImpacto = campos?.find((c) => c.role === 'IMPACT');

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    setBusqueda(search.trim());
    setPage(1); // una busqueda nueva arranca en la primera pagina
  }

  if (isLoading && !data) return <Cargando texto="Cargando registros..." />;
  if (error) return <MensajeError mensaje="No se pudieron cargar los registros" />;

  return (
    <div className="tarjeta overflow-hidden">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 p-4 sm:p-5">
        <div>
          <h2 className="font-bold">Registros</h2>
          <p className="text-sm text-slate-500">{data?.total ?? 0} desvio/s</p>
        </div>

        {/* En telefono el buscador toma el ancho completo en su propia fila. */}
        <form onSubmit={buscar} className="flex w-full items-center gap-2 sm:w-auto">
          <div className="relative min-w-0 flex-1 sm:flex-none">
            <Search size={16} className="absolute left-3 top-3 text-slate-400" />
            <input
              className="input-base pl-9"
              placeholder="Buscar por codigo o valor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button type="submit" className="boton-secundario shrink-0">
            Buscar
          </button>
        </form>
      </header>

      {data && data.items.length === 0 ? (
        <div className="p-5">
          <Vacio
            titulo="No hay desvios que coincidan"
            detalle={busqueda ? 'Probá con otro texto de busqueda.' : undefined}
          />
        </div>
      ) : (
        <>
          {/* Telefono: tarjetas apiladas. */}
          <div className="lg:hidden">
            {data?.items.map((desvio) => (
              <TarjetaDesvio
                key={desvio.id}
                desvio={desvio}
                columnas={columnas}
                campoImpacto={campoImpacto}
                onEliminar={puede('ADMIN') ? (id) => eliminar.mutate(id) : undefined}
              />
            ))}
          </div>

          {/* Escritorio: tabla. Conserva overflow-x por si el administrador
              marca muchos campos como visibles y supera los 900px. */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="p-3 font-semibold">Codigo</th>
                <th className="p-3 font-semibold">Ocurrio</th>
                <th className="p-3 font-semibold">Levantado</th>
                <th className="p-3 font-semibold">Dias</th>
                {columnas.map((c) => (
                  <th key={c.id} className="p-3 font-semibold">
                    {c.label}
                  </th>
                ))}
                {puede('ADMIN') && <th className="p-3" />}
              </tr>
            </thead>
            <tbody>
              {data?.items.map((desvio) => (
                <tr key={desvio.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3 font-bold text-marca-700">{desvio.code}</td>
                  <td className="p-3 whitespace-nowrap">{desvio.occurredOn}</td>
                  <td className="p-3 whitespace-nowrap">{desvio.raisedOn}</td>
                  <td className="p-3">
                    <Badge tono={desvio.diasHastaDeteccion > 1 ? 'rojo' : 'verde'}>
                      {desvio.diasHastaDeteccion}
                    </Badge>
                  </td>

                  {columnas.map((columna) => (
                    <td key={columna.id} className="p-3">
                      <ValorCampo
                        valor={desvio.values[columna.key]}
                        esImpacto={campoImpacto?.key === columna.key}
                      />
                    </td>
                  ))}

                  {puede('ADMIN') && (
                    <td className="p-3">
                      <BotonBorrar
                        titulo="Eliminar desvio"
                        tamano={16}
                        onConfirmar={() => eliminar.mutate(desvio.id)}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </>
      )}

      {data && data.totalPages > 1 && (
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-4 text-sm">
          <span className="text-slate-500">
            Pagina {data.page} de {data.totalPages}
          </span>
          <div className="flex gap-2">
            <button
              className="boton-secundario"
              disabled={data.page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="boton-secundario"
              disabled={data.page >= data.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}
