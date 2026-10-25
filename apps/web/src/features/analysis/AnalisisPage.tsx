/**
 * Consulta en lenguaje natural sobre los desvios.
 *
 * La pantalla no sabe que motor responde: llama a /api/analysis/ask y muestra
 * lo que vuelve, junto con la evidencia numerica y una etiqueta del motor
 * activo (local o Codex). Cuando Codex quede conectado, esta pantalla no
 * cambia.
 */
import { useState } from 'react';
import { Bot, Send } from 'lucide-react';
import { useMotorIA, usePreguntar } from '../../lib/queries';
import { MensajeError, Tarjeta } from '../../components/ui';

const SUGERENCIAS = [
  '¿Que dia se levantan mas desvios?',
  '¿Cual es la causa mas repetida?',
  '¿Cuanto tardamos en detectar los desvios?',
];

export function AnalisisPage() {
  const { data: motor } = useMotorIA();
  const preguntar = usePreguntar();
  const [pregunta, setPregunta] = useState('');

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const texto = pregunta.trim();
    if (texto.length < 3) return;
    preguntar.mutate(texto);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Tarjeta
        titulo="Preguntar a los datos"
        descripcion="Explorá patrones de los desvios registrados."
        acciones={
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Motor: {motor?.provider === 'codex' ? 'Codex' : 'local'}
          </span>
        }
      >
        <form onSubmit={enviar} className="space-y-3">
          <textarea
            className="input-base"
            rows={3}
            placeholder="Ej.: ¿Que dia nos quedan mas pendientes?"
            value={pregunta}
            onChange={(e) => setPregunta(e.target.value)}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setPregunta(s)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:border-marca-500 hover:text-marca-700"
                >
                  {s}
                </button>
              ))}
            </div>

            <button
              type="submit"
              className="boton-primario"
              disabled={preguntar.isPending || pregunta.trim().length < 3}
            >
              <Send size={16} />
              {preguntar.isPending ? 'Analizando...' : 'Preguntar'}
            </button>
          </div>
        </form>
      </Tarjeta>

      {preguntar.error && <MensajeError mensaje="No se pudo completar el analisis" />}

      {preguntar.data && (
        <div className="rounded-2xl bg-marca-50 p-6 text-marca-950">
          <div className="mb-3 flex items-center gap-2 font-bold">
            <Bot size={18} />
            Analisis
          </div>
          <p className="leading-relaxed">{preguntar.data.answer}</p>

          {/* La evidencia es lo que separa un dato de una afirmacion suelta. */}
          {preguntar.data.evidence && preguntar.data.evidence.length > 0 && (
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {preguntar.data.evidence.map((e) => (
                <div
                  key={e.label}
                  className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2 text-sm"
                >
                  <span className="capitalize text-slate-600">{e.label}</span>
                  <b>{e.value}</b>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
