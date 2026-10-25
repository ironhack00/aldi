/**
 * Contexto de sesion.
 *
 * Al montar la app se intenta un refresh silencioso: si hay cookie valida el
 * usuario entra directo, si no se muestra el login. Mientras se resuelve se
 * expone `cargando` para no parpadear la pantalla de login.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, intentarRefresh, setAccessToken } from './api';
import type { Role, Usuario } from '../types';

interface EstadoAuth {
  usuario: Usuario | null;
  cargando: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** true si el usuario tiene alguno de los roles indicados. */
  puede: (...roles: Role[]) => boolean;
}

const AuthContext = createContext<EstadoAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  // Restauracion de sesion al cargar la pagina.
  useEffect(() => {
    let vigente = true;

    (async () => {
      const ok = await intentarRefresh();
      if (ok && vigente) {
        try {
          const { user } = await api.get<{ user: Usuario }>('/auth/me');
          if (vigente) setUsuario(user);
        } catch {
          setAccessToken(null);
        }
      }
      if (vigente) setCargando(false);
    })();

    // Evita escribir estado si el componente se desmonto en el medio.
    return () => {
      vigente = false;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const datos = await api.post<{ accessToken: string; user: Usuario }>('/auth/login', {
      email,
      password,
    });
    setAccessToken(datos.accessToken);
    setUsuario(datos.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      // Se limpia el estado local pase lo que pase con el request.
      setAccessToken(null);
      setUsuario(null);
    }
  }, []);

  const valor = useMemo<EstadoAuth>(
    () => ({
      usuario,
      cargando,
      login,
      logout,
      puede: (...roles: Role[]) => (usuario ? roles.includes(usuario.role) : false),
    }),
    [usuario, cargando, login, logout],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): EstadoAuth {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return contexto;
}
