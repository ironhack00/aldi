/**
 * Hooks de datos.
 *
 * Toda la comunicacion con la API pasa por aca: las pantallas piden datos con
 * un hook y no saben que endpoint hay detras. React Query se encarga del
 * cache, del estado de carga y de refrescar lo que corresponde cuando algo
 * cambia (las `invalidateQueries` de las mutaciones).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type {
  CampoFormulario,
  Catalogo,
  CatalogoConItems,
  Desvio,
  Oportunidad,
  PaginaDesvios,
  RespuestaAnalisis,
  ResumenMetricas,
  Usuario,
} from '../types';

/** Claves de cache en un solo lugar: evita invalidar la clave equivocada. */
export const claves = {
  campos: ['campos'] as const,
  camposTodos: ['campos', 'todos'] as const,
  catalogos: ['catalogos'] as const,
  catalogo: (key: string) => ['catalogos', key] as const,
  desvios: (filtros: object) => ['desvios', filtros] as const,
  resumen: ['metricas', 'resumen'] as const,
  oportunidades: ['metricas', 'oportunidades'] as const,
  usuarios: ['usuarios'] as const,
  motorIA: ['analisis', 'motor'] as const,
};

// --- Campos ------------------------------------------------------------------

export const useCampos = (incluirInactivos = false) =>
  useQuery({
    queryKey: incluirInactivos ? claves.camposTodos : claves.campos,
    queryFn: () =>
      api
        .get<{ fields: CampoFormulario[] }>(`/fields${incluirInactivos ? '?todos=true' : ''}`)
        .then((r) => r.fields),
  });

export function useMutarCampo() {
  const qc = useQueryClient();
  // Invalida todo lo que depende del esquema de campos.
  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: claves.campos });
    void qc.invalidateQueries({ queryKey: ['desvios'] });
    void qc.invalidateQueries({ queryKey: ['metricas'] });
  };

  return {
    crear: useMutation({
      mutationFn: (datos: Record<string, unknown>) => api.post('/fields', datos),
      onSuccess: invalidar,
    }),
    actualizar: useMutation({
      mutationFn: ({ id, ...datos }: { id: string } & Record<string, unknown>) =>
        api.patch(`/fields/${id}`, datos),
      onSuccess: invalidar,
    }),
    eliminar: useMutation({
      mutationFn: (id: string) => api.delete<{ eliminado: boolean }>(`/fields/${id}`),
      onSuccess: invalidar,
    }),
    reordenar: useMutation({
      mutationFn: (ids: string[]) => api.post('/fields/reorder', { ids }),
      onSuccess: invalidar,
    }),
  };
}

// --- Catalogos ---------------------------------------------------------------

export const useCatalogos = () =>
  useQuery({
    queryKey: claves.catalogos,
    queryFn: () => api.get<{ catalogs: Catalogo[] }>('/catalogs').then((r) => r.catalogs),
  });

export const useCatalogo = (key: string | null) =>
  useQuery({
    queryKey: claves.catalogo(key ?? ''),
    queryFn: () =>
      api.get<{ catalog: CatalogoConItems }>(`/catalogs/${key}`).then((r) => r.catalog),
    enabled: Boolean(key),
  });

export function useMutarCatalogo(keyActual?: string | null) {
  const qc = useQueryClient();
  const invalidar = () => {
    void qc.invalidateQueries({ queryKey: claves.catalogos });
    void qc.invalidateQueries({ queryKey: claves.campos });
    if (keyActual) void qc.invalidateQueries({ queryKey: claves.catalogo(keyActual) });
  };

  return {
    crearCatalogo: useMutation({
      mutationFn: (datos: Record<string, unknown>) => api.post('/catalogs', datos),
      onSuccess: invalidar,
    }),
    eliminarCatalogo: useMutation({
      mutationFn: (id: string) => api.delete(`/catalogs/${id}`),
      onSuccess: invalidar,
    }),
    crearItem: useMutation({
      mutationFn: ({ catalogId, ...datos }: { catalogId: string } & Record<string, unknown>) =>
        api.post(`/catalogs/${catalogId}/items`, datos),
      onSuccess: invalidar,
    }),
    actualizarItem: useMutation({
      mutationFn: ({ id, ...datos }: { id: string } & Record<string, unknown>) =>
        api.patch(`/catalogs/items/${id}`, datos),
      onSuccess: invalidar,
    }),
    eliminarItem: useMutation({
      mutationFn: (id: string) => api.delete<{ eliminado: boolean }>(`/catalogs/items/${id}`),
      onSuccess: invalidar,
    }),
  };
}

// --- Desvios -----------------------------------------------------------------

export interface FiltrosDesvios {
  page?: number;
  pageSize?: number;
  search?: string;
  desde?: string;
  hasta?: string;
}

export const useDesvios = (filtros: FiltrosDesvios) =>
  useQuery({
    queryKey: claves.desvios(filtros),
    queryFn: () => {
      const params = new URLSearchParams();
      for (const [clave, valor] of Object.entries(filtros)) {
        if (valor !== undefined && valor !== '') params.set(clave, String(valor));
      }
      return api.get<PaginaDesvios>(`/deviations?${params.toString()}`);
    },
    // Al paginar, mantener la pagina anterior visible evita el salto a vacio.
    placeholderData: (previo) => previo,
  });

export function useCrearDesvio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (datos: { occurredOn: string; raisedOn: string; values: Record<string, unknown> }) =>
      api.post<{ deviation: Desvio }>('/deviations', datos),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['desvios'] });
      void qc.invalidateQueries({ queryKey: ['metricas'] });
    },
  });
}

export function useEliminarDesvio() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/deviations/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['desvios'] });
      void qc.invalidateQueries({ queryKey: ['metricas'] });
    },
  });
}

// --- Metricas ----------------------------------------------------------------

export const useResumen = () =>
  useQuery({
    queryKey: claves.resumen,
    queryFn: () => api.get<{ summary: ResumenMetricas }>('/metrics/summary').then((r) => r.summary),
  });

export const useOportunidades = () =>
  useQuery({
    queryKey: claves.oportunidades,
    queryFn: () =>
      api.get<{ opportunities: Oportunidad[] }>('/metrics/opportunities').then((r) => r.opportunities),
  });

// --- Analisis ----------------------------------------------------------------

export const useMotorIA = () =>
  useQuery({
    queryKey: claves.motorIA,
    queryFn: () => api.get<{ provider: 'local' | 'codex' }>('/analysis/provider'),
    staleTime: Infinity,
  });

export const usePreguntar = () =>
  useMutation({
    mutationFn: (question: string) => api.post<RespuestaAnalisis>('/analysis/ask', { question }),
  });

// --- Usuarios ----------------------------------------------------------------

export const useUsuarios = () =>
  useQuery({
    queryKey: claves.usuarios,
    queryFn: () => api.get<{ users: Usuario[] }>('/users').then((r) => r.users),
  });

export function useMutarUsuario() {
  const qc = useQueryClient();
  const invalidar = () => void qc.invalidateQueries({ queryKey: claves.usuarios });

  return {
    crear: useMutation({
      mutationFn: (datos: Record<string, unknown>) => api.post('/users', datos),
      onSuccess: invalidar,
    }),
    actualizar: useMutation({
      mutationFn: ({ id, ...datos }: { id: string } & Record<string, unknown>) =>
        api.patch(`/users/${id}`, datos),
      onSuccess: invalidar,
    }),
    eliminar: useMutation({
      mutationFn: (id: string) => api.delete(`/users/${id}`),
      onSuccess: invalidar,
    }),
  };
}
