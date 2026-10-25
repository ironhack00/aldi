/**
 * Validacion de los valores dinamicos de un desvio.
 *
 * Esta es la pieza que reemplaza al esquema estatico: dado el mapa
 * { key: valor } que manda el cliente y las definiciones de campo vigentes en
 * la base, decide si los datos son validos y los convierte a las columnas
 * tipadas de DeviationValue.
 */
import { FieldType, type Prisma } from '@prisma/client';
import { BadRequestError } from '../../shared/errors.js';
import { parseFechaISO } from '../../shared/dates.js';

/** Definicion de campo minima que necesita la validacion. */
export interface CampoValidable {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  catalogId: string | null;
  /** Ids de items validos (solo activos) cuando el campo es una lista. */
  opcionesValidas: Set<string>;
}

/** Fila lista para insertar en deviation_values. */
export type ValorPersistible = Omit<Prisma.DeviationValueCreateManyInput, 'deviationId'>;

/**
 * Valida el mapa de valores y lo traduce a filas.
 * Acumula todos los errores antes de fallar: el usuario ve de una vez todo lo
 * que tiene que corregir, no un error por intento.
 */
export function validarValores(
  valores: Record<string, unknown>,
  campos: CampoValidable[],
): ValorPersistible[] {
  const errores: { campo: string; mensaje: string }[] = [];
  const filas: ValorPersistible[] = [];

  // Un valor para un campo que no existe es un error del cliente, no algo a
  // ignorar en silencio: suele indicar un formulario desactualizado.
  const keysConocidas = new Set(campos.map((c) => c.key));
  for (const key of Object.keys(valores)) {
    if (!keysConocidas.has(key)) {
      errores.push({ campo: key, mensaje: 'El campo no existe o esta desactivado' });
    }
  }

  for (const campo of campos) {
    const bruto = valores[campo.key];
    const vacio =
      bruto === undefined ||
      bruto === null ||
      bruto === '' ||
      (Array.isArray(bruto) && bruto.length === 0);

    if (vacio) {
      if (campo.required) errores.push({ campo: campo.key, mensaje: `"${campo.label}" es obligatorio` });
      continue;
    }

    try {
      filas.push(...convertir(campo, bruto));
    } catch (e) {
      errores.push({ campo: campo.key, mensaje: (e as Error).message });
    }
  }

  if (errores.length > 0) {
    throw new BadRequestError('Hay campos con valores invalidos', errores);
  }

  return filas;
}

/** Traduce un valor al par (columna, dato) que corresponde al tipo del campo. */
function convertir(campo: CampoValidable, bruto: unknown): ValorPersistible[] {
  const base = { fieldId: campo.id };

  switch (campo.type) {
    case FieldType.TEXT:
    case FieldType.TEXTAREA: {
      const texto = String(bruto).trim();
      if (texto.length > 2000) throw new Error('El texto supera los 2000 caracteres');
      return [{ ...base, valueText: texto }];
    }

    case FieldType.NUMBER: {
      const numero = typeof bruto === 'number' ? bruto : Number(bruto);
      if (!Number.isFinite(numero)) throw new Error('Se esperaba un numero');
      return [{ ...base, valueNumber: numero }];
    }

    case FieldType.DATE: {
      const texto = String(bruto);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) throw new Error('Formato esperado: AAAA-MM-DD');
      return [{ ...base, valueDate: parseFechaISO(texto) }];
    }

    case FieldType.BOOLEAN:
      return [{ ...base, valueBool: bruto === true || bruto === 'true' }];

    case FieldType.SELECT: {
      const id = String(bruto);
      if (!campo.opcionesValidas.has(id)) throw new Error('La opcion elegida no es valida');
      return [{ ...base, catalogItemId: id }];
    }

    case FieldType.MULTISELECT: {
      const ids = Array.isArray(bruto) ? bruto.map(String) : [String(bruto)];
      const unicos = [...new Set(ids)];
      for (const id of unicos) {
        if (!campo.opcionesValidas.has(id)) throw new Error('Una de las opciones no es valida');
      }
      // Multiselect = una fila por opcion elegida.
      return unicos.map((id) => ({ ...base, catalogItemId: id }));
    }

    default:
      throw new Error('Tipo de campo no soportado');
  }
}
