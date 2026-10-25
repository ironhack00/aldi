/**
 * Marco de la aplicacion: encabezado, navegacion y contenedor del contenido.
 *
 * La navegacion se arma a partir de una lista con el rol requerido por item,
 * asi un operador no ve (ni puede abrir) la administracion.
 */
import { NavLink, Outlet } from 'react-router-dom';
import { BarChart3, Bot, ClipboardPlus, Database, LogOut, Settings, TrendingUp } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Badge } from './ui';
import type { Role } from '../types';

interface ItemNav {
  to: string;
  label: string;
  Icono: typeof BarChart3;
  /** Roles que pueden ver el item; undefined = todos. */
  roles?: Role[];
}

const NAV: ItemNav[] = [
  { to: '/', label: 'Resumen', Icono: BarChart3 },
  { to: '/registrar', label: 'Registrar', Icono: ClipboardPlus },
  { to: '/registros', label: 'Registros', Icono: Database },
  { to: '/analisis', label: 'Analisis', Icono: Bot },
  { to: '/admin', label: 'Administracion', Icono: Settings, roles: ['ADMIN'] },
];

export function Layout() {
  const { usuario, logout, puede } = useAuth();

  const items = NAV.filter((item) => !item.roles || puede(...item.roles));

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 p-4 sm:gap-4 sm:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="shrink-0 rounded-xl bg-marca-600 p-2 text-white">
              <TrendingUp size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold leading-tight sm:text-lg">
                Gestion inteligente de desvios
              </h1>
              {/* El subtitulo es contexto, no informacion: se oculta antes que
                  comprimir el titulo en un telefono. */}
              <p className="hidden truncate text-sm text-slate-500 sm:block">
                Insectario · Calidad operativa
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="text-right">
              <p className="hidden max-w-[12ch] truncate text-sm font-semibold sm:block">
                {usuario?.name}
              </p>
              <Badge tono="marca">{usuario?.role}</Badge>
            </div>
            <button
              onClick={() => void logout()}
              className="boton-secundario"
              title="Cerrar sesion"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <nav className="border-b border-slate-200 bg-white">
        <div className="tira-scroll mx-auto max-w-7xl px-4 pb-3 sm:px-5">
          {items.map(({ to, label, Icono }) => (
            <NavLink
              key={to}
              to={to}
              // `end` solo en la raiz: sin eso "/" quedaria activo en todas.
              end={to === '/'}
              className={({ isActive }) =>
                `tira-item ${
                  isActive
                    ? 'bg-marca-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-marca-50'
                }`
              }
            >
              <Icono size={16} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-7xl p-4 sm:p-5">
        <Outlet />
      </main>
    </div>
  );
}
