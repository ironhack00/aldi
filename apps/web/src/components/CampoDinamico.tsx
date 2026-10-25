/**
 * Renderizador de un campo definido en la base.
 *
 * Es la pieza que hace que el formulario no tenga nada hardcodeado: recibe una
 * `CampoFormulario` y decide que control dibujar. Si manana el administrador
 * agrega un campo numerico nuevo, aparece aca sin tocar una linea de codigo.
 *
 * Las cascadas (Problema -> Especificacion) se resuelven filtrando las
 * opciones por el `parentId` del item elegido en el campo padre.
 */
import type { CampoFormulario } from '../types';

export type ValorCampo = string | number | boolean | string[] | null;

interface Props {
  campo: CampoFormulario;
  valor: ValorCampo;
  /** Valores de todo el formulario: necesarios para resolver cascadas. */
  valores: Record<string, ValorCampo>;
  onChange: (valor: ValorCampo) => void;
  /** Mensaje de error puntual de este campo. */
  error?: string;
}

export function CampoDinamico({ campo, valor, valores, onChange, error }: Props) {
  /**
   * Opciones efectivas del campo.
   * - sin cascada: los items de primer nivel (sin padre);
   * - con cascada: los hijos del item elegido en el campo padre.
   */
  const opciones = (() => {
    if (!campo.dependsOn) return campo.options.filter((o) => o.parentId === null);

    const valorPadre = valores[campo.dependsOn];
    if (typeof valorPadre !== 'string' || !valorPadre) return [];
    return campo.options.filter((o) => o.parentId === valorPadre);
  })();

  const deshabilitado = Boolean(campo.dependsOn) && opciones.length === 0;

  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold text-slate-700">
        {campo.label}
        {campo.required && <span className="ml-1 text-red-500">*</span>}
      </span>

      {control()}

      {campo.helpText && !error && <p className="text-xs text-slate-400">{campo.helpText}</p>}
      {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
    </label>
  );

  function control() {
    switch (campo.type) {
      case 'TEXTAREA':
        return (
          <textarea
            className="input-base"
            rows={3}
            value={typeof valor === 'string' ? valor : ''}
            onChange={(e) => onChange(e.target.value)}
          />
        );

      case 'NUMBER':
        return (
          <input
            type="number"
            className="input-base"
            value={typeof valor === 'number' ? valor : ''}
            // Campo vacio -> null, no 0: "sin dato" y "cero" no son lo mismo.
            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          />
        );

      case 'DATE':
        return (
          <input
            type="date"
            className="input-base"
            value={typeof valor === 'string' ? valor : ''}
            onChange={(e) => onChange(e.target.value)}
          />
        );

      case 'BOOLEAN':
        return (
          <div className="flex h-11 items-center">
            <input
              type="checkbox"
              className="h-5 w-5 rounded border-slate-300 text-marca-600 focus:ring-marca-500"
              checked={valor === true}
              onChange={(e) => onChange(e.target.checked)}
            />
          </div>
        );

      case 'SELECT':
        return (
          <select
            className="input-base"
            value={typeof valor === 'string' ? valor : ''}
            disabled={deshabilitado}
            onChange={(e) => onChange(e.target.value || null)}
          >
            <option value="">
              {deshabilitado ? 'Elegí primero el campo anterior' : 'Seleccionar'}
            </option>
            {opciones.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        );

      case 'MULTISELECT': {
        const seleccionados = Array.isArray(valor) ? valor : [];
        return (
          <div className="max-h-40 space-y-1.5 overflow-auto rounded-xl border border-slate-200 p-3">
            {opciones.length === 0 && <p className="text-xs text-slate-400">Sin opciones</p>}
            {opciones.map((o) => (
              <label key={o.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-marca-600"
                  checked={seleccionados.includes(o.id)}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...seleccionados, o.id]
                        : seleccionados.filter((id) => id !== o.id),
                    )
                  }
                />
                {o.label}
              </label>
            ))}
          </div>
        );
      }

      case 'TEXT':
      default:
        return (
          <input
            type="text"
            className="input-base"
            value={typeof valor === 'string' ? valor : ''}
            onChange={(e) => onChange(e.target.value)}
          />
        );
    }
  }
}
