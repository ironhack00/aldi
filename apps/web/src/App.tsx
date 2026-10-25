/**
 * Rutas de la aplicacion.
 *
 * Tres estados posibles:
 *   - restaurando sesion -> pantalla de carga (evita el parpadeo del login);
 *   - sin sesion          -> login, y nada mas;
 *   - con sesion          -> layout con las rutas, filtradas por rol.
 *
 * Las rutas protegidas por rol se verifican ademas en la API: esconder un
 * boton no es un control de acceso.
 */
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { Layout } from './components/Layout';
import { Cargando } from './components/ui';
import { LoginPage } from './features/auth/LoginPage';
import { DashboardPage } from './features/dashboard/DashboardPage';
import { RegistrarPage } from './features/deviations/RegistrarPage';
import { RegistrosPage } from './features/deviations/RegistrosPage';
import { AnalisisPage } from './features/analysis/AnalisisPage';
import { AdminPage } from './features/admin/AdminPage';

export function App() {
  const { usuario, cargando, puede } = useAuth();

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Cargando texto="Restaurando sesion..." />
      </div>
    );
  }

  if (!usuario) return <LoginPage />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/registrar" element={<RegistrarPage />} />
        <Route path="/registros" element={<RegistrosPage />} />
        <Route path="/analisis" element={<AnalisisPage />} />
        <Route
          path="/admin"
          element={puede('ADMIN') ? <AdminPage /> : <Navigate to="/" replace />}
        />
        {/* Cualquier ruta desconocida vuelve al tablero. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
