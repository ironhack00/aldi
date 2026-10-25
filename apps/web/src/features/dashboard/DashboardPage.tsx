/**
 * Tablero de resumen.
 *
 * Todos los numeros vienen calculados del backend (/api/metrics/summary): la
 * pantalla no hace aritmetica, solo los presenta. Asi el tablero y el modulo
 * de analisis no pueden contradecirse.
 */
import { useOportunidades, useResumen } from '../../lib/queries';
import {
  BarrasHorizontales,
  Badge,
  Cargando,
  Kpi,
  MensajeError,
  Tarjeta,
  Vacio,
} from '../../components/ui';

export function DashboardPage() {
  const resumen = useResumen();
  const oportunidades = useOportunidades();

  if (resumen.isLoading) return <Cargando texto="Calculando indicadores..." />;
  if (resumen.error) return <MensajeError mensaje="No se pudieron cargar los indicadores" />;

  const datos = resumen.data!;

  if (datos.totalDesvios === 0) {
    return (
      <Vacio
        titulo="Todavia no hay desvios registrados"
        detalle="Cargá el primero desde la pestana Registrar y los indicadores se calculan solos."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi etiqueta="Desvios registrados" valor={datos.totalDesvios} tono="marca" />
        <Kpi
          etiqueta="Promedio hasta deteccion"
          valor={datos.promedioDeteccion === null ? '—' : `${datos.promedioDeteccion} dias`}
          tono="ambar"
        />
        <Kpi etiqueta="Detectados tarde" valor={datos.detectadosTarde} tono="rojo" />
        <Kpi etiqueta="Levantados el mismo dia" valor={datos.detectadosMismoDia} tono="verde" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Tarjeta
          titulo="Desvios levantados por dia"
          descripcion="Para detectar acumulacion durante la semana."
        >
          <BarrasHorizontales
            datos={datos.porDiaSemana.map((d) => ({ etiqueta: d.dia, valor: d.cantidad }))}
          />
        </Tarjeta>

        <Tarjeta
          titulo="Oportunidades de deteccion"
          descripcion="Los desvios que mas tardaron en levantarse."
        >
          {oportunidades.isLoading && <Cargando />}
          <div className="space-y-3">
            {oportunidades.data?.map((o) => (
              <div
                key={o.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 p-4"
              >
                <div className="min-w-0">
                  <b className="text-marca-700">{o.code}</b>
                  <p className="mt-0.5 truncate text-sm text-slate-500" title={o.detalle}>
                    {o.detalle || 'Sin detalle'}
                  </p>
                </div>
                {/* Mas de un dia de demora es lo que el negocio quiere atacar. */}
                <span className="shrink-0">
                  <Badge tono={o.dias > 1 ? 'rojo' : 'verde'}>{o.dias} dia/s</Badge>
                </span>
              </div>
            ))}
          </div>
        </Tarjeta>
      </div>

      {/* Top por campo: se arma solo con los campos que existan en la base. */}
      {datos.topPorCampo.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-3">
          {datos.topPorCampo.slice(0, 3).map((campo) => (
            <Tarjeta key={campo.campo} titulo={campo.label} descripcion="Valores mas frecuentes">
              <BarrasHorizontales
                datos={campo.items.map((i) => ({ etiqueta: i.label, valor: i.cantidad }))}
              />
            </Tarjeta>
          ))}
        </div>
      )}
    </div>
  );
}
