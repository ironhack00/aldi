/**
 * Administracion de usuarios.
 *
 * Alcance del MVP: crear, cambiar rol y activar/desactivar. No hay
 * recuperacion de contrasena por mail (el admin la resetea a mano), que es
 * suficiente para un insectario con pocos usuarios y evita montar un servicio
 * de correo para la demo.
 */
import { useState } from 'react';
import { Plus, Power } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useMutarUsuario, useUsuarios } from '../../lib/queries';
import { ApiError } from '../../lib/api';
import { Badge, Cargando, MensajeError, Tarjeta } from '../../components/ui';
import type { Role } from '../../types';

const ROLES: { valor: Role; label: string; descripcion: string }[] = [
  { valor: 'ADMIN', label: 'Administrador', descripcion: 'Configura catalogos, campos y usuarios' },
  { valor: 'SUPERVISOR', label: 'Supervisor', descripcion: 'Registra, edita y consulta desvios' },
  { valor: 'OPERADOR', label: 'Operador', descripcion: 'Registra y consulta desvios' },
];

const FORMULARIO_VACIO = {
  name: '',
  email: '',
  password: '',
  role: 'OPERADOR' as Role,
};

export function UsuariosTab() {
  const { usuario: usuarioActual } = useAuth();
  const { data: usuarios, isLoading } = useUsuarios();
  const mutar = useMutarUsuario();

  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(FORMULARIO_VACIO);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await mutar.crear.mutateAsync(form);
      setForm(FORMULARIO_VACIO);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el usuario');
    }
  }

  async function cambiarRol(id: string, role: Role) {
    setError(null);
    try {
      await mutar.actualizar.mutateAsync({ id, role });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el rol');
    }
  }

  if (isLoading) return <Cargando />;

  return (
    <div className="space-y-5">
      {error && <MensajeError mensaje={error} />}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <Tarjeta titulo="Usuarios" descripcion="Quien puede entrar y con que permisos.">
          <div className="space-y-1">
            {usuarios?.map((u) => {
              // El propio admin no puede cambiarse el rol ni desactivarse: la
              // API lo rechaza, asi que la UI tampoco lo ofrece.
              const esUnoMismo = u.id === usuarioActual?.id;

              return (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{u.name}</span>
                      {esUnoMismo && <Badge tono="marca">vos</Badge>}
                    </div>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      className="input-base w-auto py-1.5 text-xs"
                      value={u.role}
                      disabled={esUnoMismo}
                      onChange={(e) => void cambiarRol(u.id, e.target.value as Role)}
                    >
                      {ROLES.map((r) => (
                        <option key={r.valor} value={r.valor}>
                          {r.label}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() =>
                        void mutar.actualizar.mutateAsync({ id: u.id, isActive: false })
                      }
                      disabled={esUnoMismo}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 disabled:opacity-30"
                      title="Desactivar usuario"
                    >
                      <Power size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Nuevo usuario">
          <form onSubmit={crear} className="space-y-3">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">Nombre</span>
              <input
                className="input-base"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                minLength={2}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">Email</span>
              <input
                type="email"
                className="input-base"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">Contrasena inicial</span>
              <input
                type="text"
                className="input-base"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                minLength={8}
                placeholder="Minimo 8 caracteres"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-slate-700">Rol</span>
              <select
                className="input-base"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              >
                {ROLES.map((r) => (
                  <option key={r.valor} value={r.valor}>
                    {r.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400">
                {ROLES.find((r) => r.valor === form.role)?.descripcion}
              </p>
            </label>

            <button type="submit" className="boton-primario w-full" disabled={mutar.crear.isPending}>
              <Plus size={16} />
              Crear usuario
            </button>
          </form>
        </Tarjeta>
      </div>
    </div>
  );
}
