/**
 * Administracion de los campos del formulario de desvio.
 *
 * Esta es la pantalla que cumple el requisito de "nada hardcodeado": desde
 * aca se agrega un campo nuevo, se elige su tipo, de que catalogo saca las
 * opciones, si depende de otro campo en cascada y en que orden aparece. El
 * formulario de registro y las columnas de la tabla se reconstruyen solos.
 *
 * El `rol` merece una nota: es lo que le dice al sistema que significa el
 * campo para los calculos (cual es la actividad de origen, cual la de
 * deteccion, cual el impacto). Sin eso, renombrar un campo rompería las
 * metricas.
 */
import { useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Power, Trash2 } from 'lucide-react';
import { useCampos, useCatalogos, useMutarCampo } from '../../lib/queries';
import { ApiError } from '../../lib/api';
import { Badge, Cargando, MensajeError, Tarjeta, Vacio } from '../../components/ui';
import type { CampoFormulario, FieldRole, FieldType } from '../../types';

/** Tipos de campo con una explicacion en lenguaje llano. */
const TIPOS: { valor: FieldType; label: string }[] = [
  { valor: 'TEXT', label: 'Texto corto' },
  { valor: 'TEXTAREA', label: 'Texto largo' },
  { valor: 'NUMBER', label: 'Numero' },
  { valor: 'DATE', label: 'Fecha' },
  { valor: 'BOOLEAN', label: 'Si / No' },
  { valor: 'SELECT', label: 'Lista (un valor)' },
  { valor: 'MULTISELECT', label: 'Lista (varios valores)' },
];

const ROLES: { valor: FieldRole; label: string }[] = [
  { valor: 'NONE', label: 'Sin rol especial' },
  { valor: 'ACTIVITY_ORIGIN', label: 'Actividad responsable' },
  { valor: 'ACTIVITY_DETECTION', label: 'Actividad de deteccion' },
  { valor: 'IMPACT', label: 'Impacto / severidad' },
  { valor: 'SPECIES', label: 'Especie' },
  { valor: 'BATCH', label: 'Lote' },
];

/** Estado inicial del formulario de alta. */
const FORMULARIO_VACIO = {
  label: '',
  type: 'TEXT' as FieldType,
  role: 'NONE' as FieldRole,
  catalogId: '',
  parentFieldId: '',
  required: false,
  showInTable: true,
  helpText: '',
};

export function CamposTab() {
  // `true`: el panel muestra tambien los campos desactivados.
  const { data: campos, isLoading } = useCampos(true);
  const { data: catalogos } = useCatalogos();
  const mutar = useMutarCampo();

  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(FORMULARIO_VACIO);

  const esLista = form.type === 'SELECT' || form.type === 'MULTISELECT';
  /**
   * Solo un campo de tipo lista sobre un catalogo jerarquico puede ser padre
   * de una cascada: la cascada consiste en mostrar los hijos del item elegido.
   */
  const candidatosPadre = (campos ?? []).filter(
    (c) => c.type === 'SELECT' && c.catalogHierarchical,
  );

  /** Genera una `key` estable a partir de la etiqueta (camelCase sin acentos). */
  function aKey(label: string): string {
    const palabras = label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .split(/\s+/);

    return palabras
      .map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)))
      .join('')
      .slice(0, 40);
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const key = aKey(form.label);
    if (!key) {
      setError('La etiqueta tiene que contener al menos una letra o numero');
      return;
    }

    try {
      await mutar.crear.mutateAsync({
        key,
        label: form.label.trim(),
        type: form.type,
        role: form.role,
        catalogId: esLista ? form.catalogId || null : null,
        parentFieldId: form.parentFieldId || null,
        required: form.required,
        showInTable: form.showInTable,
        helpText: form.helpText.trim() || null,
      });
      setForm(FORMULARIO_VACIO);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el campo');
    }
  }

  /** Mueve un campo una posicion y persiste el orden completo. */
  async function mover(indice: number, direccion: -1 | 1) {
    if (!campos) return;
    const destino = indice + direccion;
    if (destino < 0 || destino >= campos.length) return;

    const ids = campos.map((c) => c.id);
    [ids[indice], ids[destino]] = [ids[destino]!, ids[indice]!];

    setError(null);
    try {
      await mutar.reordenar.mutateAsync(ids);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo reordenar');
    }
  }

  async function borrar(campo: CampoFormulario) {
    setError(null);
    try {
      const { eliminado } = await mutar.eliminar.mutateAsync(campo.id);
      if (!eliminado) {
        setError(
          `"${campo.label}" tiene datos cargados, asi que se desactivo en lugar de borrarse. Los desvios historicos conservan su valor.`,
        );
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el campo');
    }
  }

  if (isLoading) return <Cargando />;

  return (
    <div className="space-y-5">
      {error && <MensajeError mensaje={error} />}

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        {/* --- Campos existentes --- */}
        <Tarjeta
          titulo="Campos del formulario"
          descripcion="El orden de esta lista es el orden en que aparecen al registrar un desvio."
        >
          {!campos || campos.length === 0 ? (
            <Vacio titulo="Sin campos definidos" />
          ) : (
            <div className="space-y-1">
              {campos.map((campo, indice) => (
                <div
                  key={campo.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold">{campo.label}</span>
                      {campo.required && <Badge tono="rojo">obligatorio</Badge>}
                      {campo.dependsOn && <Badge tono="marca">cascada</Badge>}
                      {!campo.showInTable && <Badge>oculto en tabla</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      <code>{campo.key}</code> · {TIPOS.find((t) => t.valor === campo.type)?.label}
                      {campo.role !== 'NONE' &&
                        ` · ${ROLES.find((r) => r.valor === campo.role)?.label}`}
                      {campo.options.length > 0 && ` · ${campo.options.length} opciones`}
                    </p>
                  </div>

                  <div className="flex shrink-0 gap-1">
                    <button
                      onClick={() => void mover(indice, -1)}
                      disabled={indice === 0}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 disabled:opacity-30"
                      title="Subir"
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      onClick={() => void mover(indice, 1)}
                      disabled={indice === campos.length - 1}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 disabled:opacity-30"
                      title="Bajar"
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      onClick={() =>
                        void mutar.actualizar.mutateAsync({
                          id: campo.id,
                          required: !campo.required,
                        })
                      }
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100"
                      title="Alternar obligatorio"
                    >
                      <Power size={15} />
                    </button>
                    <button
                      onClick={() => void borrar(campo)}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      title="Eliminar"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Tarjeta>

        {/* --- Alta de campo --- */}
        <Tarjeta titulo="Agregar un campo" descripcion="Aparece en el formulario al instante.">
          <form onSubmit={crear} className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">Etiqueta</span>
              <input
                className="input-base"
                placeholder="Ej: Turno"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                required
              />
              {form.label && (
                <p className="text-xs text-slate-400">
                  Clave interna: <code>{aKey(form.label)}</code>
                </p>
              )}
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">Tipo</span>
              <select
                className="input-base"
                value={form.type}
                onChange={(e) =>
                  // Al cambiar de tipo se limpian las opciones que ya no aplican.
                  setForm({
                    ...form,
                    type: e.target.value as FieldType,
                    catalogId: '',
                    parentFieldId: '',
                  })
                }
              >
                {TIPOS.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            {esLista && (
              <>
                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">Catalogo de opciones</span>
                  <select
                    className="input-base"
                    value={form.catalogId}
                    onChange={(e) => setForm({ ...form, catalogId: e.target.value })}
                    required
                  >
                    <option value="">Seleccionar</option>
                    {catalogos?.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c._count?.items ?? 0})
                      </option>
                    ))}
                  </select>
                </label>

                {candidatosPadre.length > 0 && (
                  <label className="block space-y-1.5">
                    <span className="text-sm font-semibold text-slate-700">
                      Depende de (cascada)
                    </span>
                    <select
                      className="input-base"
                      value={form.parentFieldId}
                      onChange={(e) => setForm({ ...form, parentFieldId: e.target.value })}
                    >
                      <option value="">No depende de otro campo</option>
                      {candidatosPadre.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-slate-400">
                      Mostrará solo los sub-valores del elegido en el campo padre.
                    </p>
                  </label>
                )}
              </>
            )}

            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">Rol en los calculos</span>
              <select
                className="input-base"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as FieldRole })}
              >
                {ROLES.map((r) => (
                  <option key={r.valor} value={r.valor}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">Texto de ayuda</span>
              <input
                className="input-base"
                placeholder="Opcional"
                value={form.helpText}
                onChange={(e) => setForm({ ...form, helpText: e.target.value })}
              />
            </label>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-marca-600"
                  checked={form.required}
                  onChange={(e) => setForm({ ...form, required: e.target.checked })}
                />
                Obligatorio
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-marca-600"
                  checked={form.showInTable}
                  onChange={(e) => setForm({ ...form, showInTable: e.target.checked })}
                />
                Mostrar como columna en Registros
              </label>
            </div>

            <button type="submit" className="boton-primario w-full" disabled={mutar.crear.isPending}>
              <Plus size={16} />
              Crear campo
            </button>
          </form>
        </Tarjeta>
      </div>
    </div>
  );
}
