/**
 * Alta de un desvio.
 *
 * El formulario se construye en runtime desde /api/fields: no hay un solo
 * campo escrito a mano. Las dos fechas si son fijas, porque son columnas
 * propias del desvio y los indicadores dependen de ellas.
 *
 * Dos ayudas en vivo mientras se completa:
 *   - dias entre ocurrencia y levantamiento;
 *   - distancia en etapas entre la actividad responsable y la de deteccion,
 *     leyendo `flowPosition` de las opciones (no una lista de etapas en el
 *     codigo del frontend).
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import { useCampos, useCrearDesvio } from '../../lib/queries';
import { ApiError } from '../../lib/api';
import { CampoDinamico, type ValorCampo } from '../../components/CampoDinamico';
import { Cargando, MensajeError, Tarjeta, Vacio } from '../../components/ui';

const hoy = (): string => new Date().toISOString().slice(0, 10);

export function RegistrarPage() {
  const navegar = useNavigate();
  const { data: campos, isLoading } = useCampos();
  const crear = useCrearDesvio();

  const [occurredOn, setOccurredOn] = useState(hoy);
  const [raisedOn, setRaisedOn] = useState(hoy);
  const [valores, setValores] = useState<Record<string, ValorCampo>>({});
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null);
  /** Errores por campo que devuelve la validacion del backend. */
  const [erroresCampo, setErroresCampo] = useState<Record<string, string>>({});

  /**
   * Cambia un valor y limpia los campos que dependen de el: si cambia el
   * problema, la especificacion elegida ya no corresponde.
   */
  function cambiar(key: string, valor: ValorCampo) {
    setValores((previo) => {
      const siguiente = { ...previo, [key]: valor };
      for (const campo of campos ?? []) {
        if (campo.dependsOn === key) siguiente[campo.key] = null;
      }
      return siguiente;
    });
    setErroresCampo(({ [key]: _, ...resto }) => resto);
  }

  const dias = useMemo(() => {
    const a = new Date(`${occurredOn}T00:00:00Z`).getTime();
    const b = new Date(`${raisedOn}T00:00:00Z`).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) return null;
    return Math.round((b - a) / 86_400_000);
  }, [occurredOn, raisedOn]);

  /** Distancia en etapas, resuelta con el flowPosition de cada opcion. */
  const distancia = useMemo(() => {
    const campoOrigen = campos?.find((c) => c.role === 'ACTIVITY_ORIGIN');
    const campoDeteccion = campos?.find((c) => c.role === 'ACTIVITY_DETECTION');
    if (!campoOrigen || !campoDeteccion) return null;

    const idOrigen = valores[campoOrigen.key];
    const idDeteccion = valores[campoDeteccion.key];
    if (typeof idOrigen !== 'string' || typeof idDeteccion !== 'string') return null;

    const posOrigen = campoOrigen.options.find((o) => o.id === idOrigen)?.flowPosition;
    const posDeteccion = campoDeteccion.options.find((o) => o.id === idDeteccion)?.flowPosition;

    // null = alguna de las dos actividades esta fuera del flujo secuencial.
    if (posOrigen == null || posDeteccion == null) return 'Flujo paralelo';
    return `${posDeteccion - posOrigen} etapa/s`;
  }, [campos, valores]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setErrorGeneral(null);
    setErroresCampo({});

    if (dias !== null && dias < 0) {
      setErrorGeneral('La fecha de levantamiento no puede ser anterior a la de ocurrencia');
      return;
    }

    try {
      await crear.mutateAsync({ occurredOn, raisedOn, values: valores });
      navegar('/registros');
    } catch (err) {
      if (err instanceof ApiError && Array.isArray(err.details)) {
        // El backend devuelve [{ campo, mensaje }]: se mapea a cada control.
        const porCampo: Record<string, string> = {};
        for (const d of err.details as { campo?: string; mensaje?: string }[]) {
          if (d.campo && d.mensaje) porCampo[d.campo] = d.mensaje;
        }
        setErroresCampo(porCampo);
        setErrorGeneral(err.message);
      } else {
        setErrorGeneral(err instanceof ApiError ? err.message : 'No se pudo guardar el desvio');
      }
    }
  }

  if (isLoading) return <Cargando texto="Cargando formulario..." />;

  if (!campos || campos.length === 0) {
    return (
      <Vacio
        titulo="El formulario no tiene campos"
        detalle="Un administrador tiene que definirlos en Administracion > Campos."
      />
    );
  }

  return (
    <form onSubmit={guardar} className="space-y-5">
      <Tarjeta
        titulo="Registrar un nuevo desvio"
        descripcion="Los datos alimentan automaticamente los indicadores del tablero."
      >
        <div className="grid gap-5 md:grid-cols-3">
          {/* Fechas: columnas propias del desvio, no campos dinamicos. */}
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">
              Fecha de ocurrencia <span className="text-red-500">*</span>
            </span>
            <input
              type="date"
              className="input-base"
              value={occurredOn}
              max={raisedOn}
              onChange={(e) => setOccurredOn(e.target.value)}
              required
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-slate-700">
              Fecha de levantamiento <span className="text-red-500">*</span>
            </span>
            <input
              type="date"
              className="input-base"
              value={raisedOn}
              min={occurredOn}
              onChange={(e) => setRaisedOn(e.target.value)}
              required
            />
          </label>

          <div className="rounded-xl bg-marca-50 p-4">
            <span className="text-sm font-semibold text-marca-950">Tiempo hasta deteccion</span>
            <p className="text-2xl font-bold text-marca-700">
              {dias === null ? '—' : `${dias} dia/s`}
            </p>
          </div>

          {/* Campos definidos por el administrador. */}
          {campos.map((campo) => (
            <CampoDinamico
              key={campo.id}
              campo={campo}
              valor={valores[campo.key] ?? null}
              valores={valores}
              onChange={(v) => cambiar(campo.key, v)}
              error={erroresCampo[campo.key]}
            />
          ))}

          {distancia && (
            <div className="rounded-xl bg-slate-50 p-4 text-sm">
              <b>Distancia entre etapas</b>
              <p className="mt-1 text-slate-600">{distancia}</p>
            </div>
          )}
        </div>
      </Tarjeta>

      {errorGeneral && <MensajeError mensaje={errorGeneral} />}

      <button type="submit" className="boton-primario" disabled={crear.isPending}>
        <Save size={16} />
        {crear.isPending ? 'Guardando...' : 'Guardar desvio'}
      </button>
    </form>
  );
}
