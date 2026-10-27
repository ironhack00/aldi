/**
 * Administracion de catalogos.
 *
 * Panel de dos columnas: a la izquierda los catalogos, a la derecha los items
 * del seleccionado. Los items jerarquicos se muestran anidados bajo su padre.
 *
 * Reglas que la UI refleja (y la API hace cumplir):
 *   - un catalogo de sistema no se borra;
 *   - un item en uso por algun desvio no se borra, se desactiva;
 *   - `flowPosition` solo tiene sentido en catalogos que representan etapas de
 *     un proceso, por eso se edita aparte.
 */
import { useState } from 'react';
import { ChevronRight, Plus, Power } from 'lucide-react';
import { useCatalogo, useCatalogos, useMutarCatalogo } from '../../lib/queries';
import { ApiError } from '../../lib/api';
import { Badge, BotonBorrar, Cargando, MensajeError, Tarjeta, Vacio } from '../../components/ui';
import type { ItemCatalogo } from '../../types';

export function CatalogosTab() {
  const { data: catalogos, isLoading } = useCatalogos();
  const [keySeleccionada, setKeySeleccionada] = useState<string | null>(null);
  const { data: catalogo } = useCatalogo(keySeleccionada);
  const mutar = useMutarCatalogo(keySeleccionada);

  const [error, setError] = useState<string | null>(null);

  // --- Alta de catalogo ------------------------------------------------------
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoJerarquico, setNuevoJerarquico] = useState(false);

  /** Deriva la `key` del nombre: el usuario no deberia pensar en slugs. */
  const aSlug = (texto: string): string =>
    texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);

  async function crearCatalogo(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await mutar.crearCatalogo.mutateAsync({
        key: aSlug(nuevoNombre),
        name: nuevoNombre.trim(),
        hierarchical: nuevoJerarquico,
      });
      setNuevoNombre('');
      setNuevoJerarquico(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el catalogo');
    }
  }

  // --- Alta de item ----------------------------------------------------------
  const [nuevoItem, setNuevoItem] = useState('');
  const [padreItem, setPadreItem] = useState<string>('');
  const [posicionFlujo, setPosicionFlujo] = useState<string>('');

  async function crearItem(e: React.FormEvent) {
    e.preventDefault();
    if (!catalogo) return;
    setError(null);
    try {
      await mutar.crearItem.mutateAsync({
        catalogId: catalogo.id,
        label: nuevoItem.trim(),
        parentId: padreItem || null,
        flowPosition: posicionFlujo === '' ? null : Number(posicionFlujo),
      });
      setNuevoItem('');
      setPosicionFlujo('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el item');
    }
  }

  async function borrarItem(item: ItemCatalogo) {
    setError(null);
    try {
      const { eliminado } = await mutar.eliminarItem.mutateAsync(item.id);
      if (!eliminado) {
        setError(
          `"${item.label}" esta en uso por desvios existentes, asi que se desactivo en lugar de borrarse.`,
        );
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el item');
    }
  }

  if (isLoading) return <Cargando />;

  // Items de primer nivel; los hijos se renderizan debajo de cada padre.
  const raices = catalogo?.items.filter((i) => i.parentId === null) ?? [];
  const posicionesUsadas = (catalogo?.items ?? [])
    .map((i) => i.flowPosition)
    .filter((p): p is number => p !== null);
  const tieneFlujo = posicionesUsadas.length > 0;
  const siguientePosicion = tieneFlujo ? Math.max(...posicionesUsadas) + 1 : 1;
  const hijosDe = (id: string) => catalogo?.items.filter((i) => i.parentId === id) ?? [];

  return (
    <div className="space-y-5">
      {error && <MensajeError mensaje={error} />}

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* --- Lista de catalogos --- */}
        <Tarjeta titulo="Catalogos" descripcion="Las listas de valores del sistema.">
          <div className="space-y-1.5">
            {catalogos?.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setKeySeleccionada(c.key);
                  setPadreItem('');
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-xl p-3 text-left transition ${
                  keySeleccionada === c.key ? 'bg-marca-50 ring-1 ring-marca-500' : 'hover:bg-slate-50'
                }`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{c.name}</p>
                  <p className="text-xs text-slate-400">
                    {c._count?.items ?? 0} items
                    {c.hierarchical && ' · jerarquico'}
                    {c.isSystem && ' · sistema'}
                  </p>
                </div>
                <ChevronRight size={16} className="shrink-0 text-slate-300" />
              </button>
            ))}
          </div>

          <form onSubmit={crearCatalogo} className="mt-5 space-y-3 border-t border-slate-100 pt-5">
            <p className="text-sm font-semibold text-slate-700">Nuevo catalogo</p>
            <input
              className="input-base"
              placeholder="Nombre. Ej: Turnos"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              required
              minLength={2}
            />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-marca-600"
                checked={nuevoJerarquico}
                onChange={(e) => setNuevoJerarquico(e.target.checked)}
              />
              Jerarquico (con sub-items en cascada)
            </label>
            <button type="submit" className="boton-primario w-full" disabled={mutar.crearCatalogo.isPending}>
              <Plus size={16} />
              Crear catalogo
            </button>
          </form>
        </Tarjeta>

        {/* --- Items del catalogo seleccionado --- */}
        {!catalogo ? (
          <Tarjeta>
            <Vacio titulo="Elegí un catalogo" detalle="Para ver y editar sus valores." />
          </Tarjeta>
        ) : (
          <Tarjeta
            titulo={catalogo.name}
            descripcion={catalogo.description ?? undefined}
            acciones={
              !catalogo.isSystem && (
                <BotonBorrar
                  etiqueta="Eliminar catalogo"
                  onConfirmar={async () => {
                    setError(null);
                    try {
                      await mutar.eliminarCatalogo.mutateAsync(catalogo.id);
                      setKeySeleccionada(null);
                    } catch (err) {
                      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar');
                    }
                  }}
                />
              )
            }
          >
            <div className="space-y-1">
              {raices.length === 0 && <Vacio titulo="Sin valores todavia" />}

              {raices.map((item) => (
                <div key={item.id}>
                  <FilaItem item={item} onDesactivar={cambiarActivo} onBorrar={borrarItem} />
                  {/* Hijos indentados: la jerarquia se ve, no se adivina. */}
                  <div className="ml-6 border-l border-slate-100 pl-3">
                    {hijosDe(item.id).map((hijo) => (
                      <FilaItem
                        key={hijo.id}
                        item={hijo}
                        onDesactivar={cambiarActivo}
                        onBorrar={borrarItem}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <form onSubmit={crearItem} className="mt-5 space-y-3 border-t border-slate-100 pt-5">
              <div>
                <p className="text-sm font-semibold text-slate-700">Nuevo valor</p>
                <p className="text-xs text-slate-500">
                  Agrega una opcion nueva a <strong>{catalogo.name}</strong>. Va a aparecer en los
                  desplegables de los campos que usan este catalogo.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Nombre del valor</span>
                  <input
                    className="input-base"
                    placeholder="Ej: Corte, Soldadura, Turno manana"
                    value={nuevoItem}
                    onChange={(e) => setNuevoItem(e.target.value)}
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-600">
                    Posicion en el flujo{' '}
                    <span className="font-normal text-slate-400">(opcional)</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    className="input-base"
                    placeholder={tieneFlujo ? `Sugerido: ${siguientePosicion}` : 'Ej: 1'}
                    value={posicionFlujo}
                    onChange={(e) => setPosicionFlujo(e.target.value)}
                  />
                </label>
              </div>
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
                <strong className="text-slate-600">Posicion en el flujo:</strong> solo aplica a
                catalogos de etapas del proceso productivo (actividades). Es el orden en que ocurre la
                etapa: 1 la primera, 2 la siguiente, etc. Sirve para calcular cuantas etapas pasaron
                entre donde se origino un desvio y donde se detecto. Si el valor no es una etapa, o es
                un proceso paralelo, dejalo vacio.
                {tieneFlujo && (
                  <>
                    {' '}
                    Posiciones ya usadas:{' '}
                    {[...posicionesUsadas].sort((a, b) => a - b).join(', ')}.
                  </>
                )}
              </p>

              {catalogo.hierarchical && (
                <select
                  className="input-base"
                  value={padreItem}
                  onChange={(e) => setPadreItem(e.target.value)}
                >
                  <option value="">Sin padre (categoria principal)</option>
                  {raices.map((r) => (
                    <option key={r.id} value={r.id}>
                      Dentro de: {r.label}
                    </option>
                  ))}
                </select>
              )}

              <button type="submit" className="boton-primario" disabled={mutar.crearItem.isPending}>
                <Plus size={16} />
                Agregar valor
              </button>
            </form>
          </Tarjeta>
        )}
      </div>
    </div>
  );

  async function cambiarActivo(item: ItemCatalogo) {
    setError(null);
    try {
      await mutar.actualizarItem.mutateAsync({ id: item.id, isActive: !item.isActive });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar');
    }
  }
}

/** Una fila de item con sus dos acciones. */
function FilaItem({
  item,
  onDesactivar,
  onBorrar,
}: {
  item: ItemCatalogo;
  onDesactivar: (item: ItemCatalogo) => void;
  onBorrar: (item: ItemCatalogo) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl p-2.5 hover:bg-slate-50">
      <div className="flex min-w-0 items-center gap-2">
        <span className={`truncate text-sm ${item.isActive ? '' : 'text-slate-400 line-through'}`}>
          {item.label}
        </span>
        {item.flowPosition !== null && <Badge tono="marca">etapa {item.flowPosition}</Badge>}
        {!item.isActive && <Badge>inactivo</Badge>}
      </div>

      <div className="flex shrink-0 gap-1">
        <button
          onClick={() => onDesactivar(item)}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          title={item.isActive ? 'Desactivar' : 'Activar'}
        >
          <Power size={15} />
        </button>
        <BotonBorrar onConfirmar={() => onBorrar(item)} />
      </div>
    </div>
  );
}
