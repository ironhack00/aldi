/**
 * Punto de entrada del frontend.
 *
 * Orden de los providers: React Query primero (los hooks de datos lo
 * necesitan), despues el contexto de sesion (que usa esos hooks), y el router
 * envolviendo todo.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { AuthProvider } from './lib/auth';
import { ApiError } from './lib/api';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Los datos de catalogos y campos no cambian cada segundo; 30s de
      // frescura evita un request por cada cambio de pestana.
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // No reintentar errores de permisos o de validacion: reintentar un 403
      // da 403 otra vez.
      retry: (intentos, error) => {
        if (error instanceof ApiError && error.status < 500) return false;
        return intentos < 2;
      },
    },
  },
});

const contenedor = document.getElementById('root');
if (!contenedor) throw new Error('No se encontro el elemento #root');

createRoot(contenedor).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
