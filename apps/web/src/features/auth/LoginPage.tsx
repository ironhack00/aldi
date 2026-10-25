/**
 * Pantalla de ingreso.
 *
 * Muestra las credenciales de los tres usuarios demo en un panel aparte: es
 * un MVP para demostracion y queremos que cualquiera pueda probar los tres
 * roles sin pedir datos. ANTES DE PRODUCCION hay que borrar ese panel (esta
 * marcado con un TODO) y cambiar las contrasenas del seed.
 */
import { useState } from 'react';
import { ShieldCheck, TrendingUp } from 'lucide-react';
import { useAuth } from '../../lib/auth';
import { ApiError } from '../../lib/api';
import { MensajeError } from '../../components/ui';

const USUARIOS_DEMO = [
  { email: 'admin@demo.com', rol: 'Administrador', descripcion: 'Configura catalogos y campos' },
  { email: 'supervisor@demo.com', rol: 'Supervisor', descripcion: 'Registra y corrige desvios' },
  { email: 'operador@demo.com', rol: 'Operador', descripcion: 'Registra y consulta' },
];

const PASSWORD_DEMO = 'Demo1234!';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'No se pudo conectar con el servidor',
      );
    } finally {
      setEnviando(false);
    }
  }

  /** Completa el formulario con un usuario demo, listo para enviar. */
  function usarDemo(emailDemo: string) {
    setEmail(emailDemo);
    setPassword(PASSWORD_DEMO);
    setError(null);
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-5">
      <div className="grid w-full max-w-4xl gap-5 md:grid-cols-2">
        {/* --- Formulario --- */}
        <form onSubmit={enviar} className="tarjeta space-y-5 p-7">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-marca-600 p-2 text-white">
              <TrendingUp size={20} />
            </div>
            <div>
              <h1 className="font-bold leading-tight">Gestion de desvios</h1>
              <p className="text-sm text-slate-500">Ingresá para continuar</p>
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Email</span>
            <input
              type="email"
              className="input-base"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">Contrasena</span>
            <input
              type="password"
              className="input-base"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>

          {error && <MensajeError mensaje={error} />}

          <button type="submit" className="boton-primario w-full" disabled={enviando}>
            {enviando ? 'Ingresando...' : 'Ingresar'}
          </button>
        </form>

        {/* --- TODO(produccion): eliminar este panel de credenciales --- */}
        <aside className="tarjeta space-y-4 bg-marca-50 p-7">
          <div className="flex items-center gap-2 font-bold text-marca-950">
            <ShieldCheck size={18} />
            Usuarios de prueba
          </div>
          <p className="text-sm text-marca-950/70">
            Entorno de demostracion. Hacé clic en un usuario para cargar sus datos.
          </p>

          <div className="space-y-2">
            {USUARIOS_DEMO.map((u) => (
              <button
                key={u.email}
                type="button"
                onClick={() => usarDemo(u.email)}
                className="w-full rounded-xl border border-marca-100 bg-white p-3 text-left transition hover:border-marca-500"
              >
                <p className="text-sm font-semibold">{u.rol}</p>
                <p className="text-xs text-slate-500">{u.email}</p>
                <p className="mt-1 text-xs text-slate-400">{u.descripcion}</p>
              </button>
            ))}
          </div>

          <p className="text-xs text-marca-950/60">
            Contrasena para los tres: <code className="font-semibold">{PASSWORD_DEMO}</code>
          </p>
        </aside>
      </div>
    </div>
  );
}
