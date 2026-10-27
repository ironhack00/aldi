/**
 * Administracion de usuarios.
 *
 * Alcance del MVP: crear, cambiar rol, activar/desactivar y borrar. Un usuario
 * con desvios cargados no se puede borrar (la API lo rechaza): se desactiva,
 * asi conserva la autoria de lo que registro. No hay
 * recuperacion de contrasena por mail (el admin la resetea a mano), que es
 * suficiente para un insectario con pocos usuarios y evita montar un servicio
 * de correo para la demo.
 */
import { useState } from 'react';
import { Check, Minus, Plus, Power } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { useMutarUsuario, useUsuarios } from '../../lib/queries';
import { ApiError } from '../../lib/api';
import { Badge, BotonBorrar, Cargando, MensajeError, Tarjeta } from '../../components/ui';
import type { Role } from '../../types';

const ROLES: { valor: Role; label: string; descripcion: string }[] = [
  { valor: 'ADMIN', label: 'Administrador', descripcion: 'Configura catalogos, campos y usuarios' },
  { valor: 'SUPERVISOR', label: 'Supervisor', descripcion: 'Registra, edita y consulta desvios' },
  { valor: 'OPERADOR', label: 'Operador', descripcion: 'Registra y consulta desvios' },
];

/**
 * Que puede hacer cada rol. Es documentacion para el administrador: la
 * verificacion real la hace la API en cada endpoint. Si se cambia un permiso
 * en el backend, hay que actualizar esta tabla a mano.
 */
const ROLES_ORDEN: Role[] = ['ADMIN', 'SUPERVISOR', 'OPERADOR'];

const PERMISOS: { accion: string; roles: Role[] }[] = [
  { accion: 'Ver resumen, registros y analisis', roles: ['ADMIN', 'SUPERVISOR', 'OPERADOR'] },
  { accion: 'Registrar desvios', roles: ['ADMIN', 'SUPERVISOR', 'OPERADOR'] },
  { accion: 'Editar desvios', roles: ['ADMIN', 'SUPERVISOR'] },
  { accion: 'Borrar desvios', roles: ['ADMIN'] },
  { accion: 'Administrar catalogos y campos', roles: ['ADMIN'] },
  { accion: 'Administrar usuarios', roles: ['ADMIN'] },
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

  async function borrar(id: string) {
    setError(null);
    try {
      await mutar.eliminar.mutateAsync(id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el usuario');
    }
  }

  async function cambiarActivo(id: string, isActive: boolean) {
    setError(null);
    try {
      await mutar.actualizar.mutateAsync({ id, isActive });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar el estado');
    }
  }

  if (isLoading) return <Cargando />;

  return (
    <div className="space-y-5">
      {error && <MensajeError mensaje={error} />}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
        <Tarjeta titulo="Usuarios" descripcion="Quien puede entrar y con que permisos.">
          <div className="space-y-1">
            {usuarios?.map((u) => {
              // El propio admin no puede cambiarse el rol ni desactivarse: la
              // API lo rechaza, asi que la UI tampoco lo ofrece.
              const esUnoMismo = u.id === usuarioActual?.id;

              return (
                <div
                  key={u.id}
                  className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 ${
                    u.isActive ? '' : 'bg-slate-50 opacity-60'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{u.name}</span>
                      {esUnoMismo && <Badge tono="marca">vos</Badge>}
                      {!u.isActive && <Badge tono="rojo">Inactivo</Badge>}
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
                      onClick={() => void cambiarActivo(u.id, !u.isActive)}
                      disabled={esUnoMismo}
                      className={`rounded-lg p-1.5 transition hover:bg-slate-100 disabled:opacity-30 ${
                        u.isActive ? 'text-slate-400' : 'text-emerald-600'
                      }`}
                      title={u.isActive ? 'Desactivar usuario' : 'Reactivar usuario'}
                    >
                      <Power size={15} />
                    </button>
                    {!esUnoMismo && (
                      <BotonBorrar titulo="Eliminar usuario" onConfirmar={() => void borrar(u.id)} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Tarjeta>

        <Tarjeta
          titulo="Permisos por rol"
          descripcion="Que puede hacer cada rol. Lo verifica el servidor en cada operacion."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-slate-500">
                <tr>
                  <th className="pb-2 pr-3 font-semibold">Accion</th>
                  {ROLES_ORDEN.map((rol) => (
                    <th key={rol} className="pb-2 px-3 text-center font-semibold">
                      {ROLES.find((r) => r.valor === rol)?.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISOS.map((p) => (
                  <tr key={p.accion} className="border-t border-slate-100">
                    <td className="py-2.5 pr-3 text-slate-700">{p.accion}</td>
                    {ROLES_ORDEN.map((rol) => {
                      const puede = p.roles.includes(rol);
                      return (
                        <td key={rol} className="px-3 py-2.5 text-center">
                          <span
                            className={`inline-flex rounded-full p-1 ${
                              puede ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                            }`}
                            title={puede ? 'Permitido' : 'No permitido'}
                          >
                            {puede ? <Check size={14} /> : <Minus size={14} />}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Tarjeta>
        </div>

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
