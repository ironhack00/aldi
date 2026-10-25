/**
 * Tipos del contrato con la API.
 *
 * Se mantienen a mano (y no generados) porque son pocos y asi el frontend no
 * necesita compilar el backend. Si el contrato crece conviene pasar a OpenAPI
 * y generarlos.
 */

export type Role = 'ADMIN' | 'SUPERVISOR' | 'OPERADOR';

export interface Usuario {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export type FieldType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'DATE'
  | 'BOOLEAN'
  | 'SELECT'
  | 'MULTISELECT';

export type FieldRole =
  | 'NONE'
  | 'ACTIVITY_ORIGIN'
  | 'ACTIVITY_DETECTION'
  | 'IMPACT'
  | 'SPECIES'
  | 'BATCH';

export interface OpcionCampo {
  id: string;
  label: string;
  parentId: string | null;
  flowPosition: number | null;
}

/** Un campo del formulario, tal como lo define el administrador. */
export interface CampoFormulario {
  id: string;
  key: string;
  label: string;
  type: FieldType;
  role: FieldRole;
  required: boolean;
  showInTable: boolean;
  order: number;
  helpText: string | null;
  /** `key` del campo del que depende en cascada. */
  dependsOn: string | null;
  /** Catalogo del que salen las opciones (null si no es una lista). */
  catalogId: string | null;
  /** Si ese catalogo admite sub-items. */
  catalogHierarchical: boolean;
  options: OpcionCampo[];
}

export interface Catalogo {
  id: string;
  key: string;
  name: string;
  description: string | null;
  hierarchical: boolean;
  isSystem: boolean;
  _count?: { items: number; fields: number };
}

export interface ItemCatalogo {
  id: string;
  catalogId: string;
  parentId: string | null;
  label: string;
  code: string | null;
  order: number;
  flowPosition: number | null;
  isActive: boolean;
}

export interface CatalogoConItems extends Catalogo {
  items: ItemCatalogo[];
}

/** Valor de un campo en un desvio: el dato crudo y su etiqueta legible. */
export interface ValorDesvio {
  raw: string | number | boolean | string[] | null;
  label: string;
}

export interface Desvio {
  id: string;
  code: string;
  occurredOn: string;
  raisedOn: string;
  diasHastaDeteccion: number;
  distanciaEtapas: number | null;
  createdBy: { id: string; name: string };
  createdAt: string;
  values: Record<string, ValorDesvio>;
}

export interface PaginaDesvios {
  items: Desvio[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ResumenMetricas {
  totalDesvios: number;
  promedioDeteccion: number | null;
  detectadosTarde: number;
  detectadosMismoDia: number;
  porDiaSemana: { dia: string; cantidad: number }[];
  topPorCampo: { campo: string; label: string; items: { label: string; cantidad: number }[] }[];
}

export interface Oportunidad {
  id: string;
  code: string;
  dias: number;
  detalle: string;
}

export interface RespuestaAnalisis {
  answer: string;
  provider: 'local' | 'codex';
  evidence?: { label: string; value: string }[];
}
