/**
 * Muestra el valor de un campo dinamico dentro de un desvio.
 *
 * Lo usan la tabla (escritorio) y las tarjetas (telefono). Vive en su propio
 * modulo para que el criterio de "que impacto se pinta en rojo" exista una
 * sola vez: si cambia, cambia en las dos vistas a la vez.
 */
import { Badge } from '../../components/ui';
import type { ValorDesvio } from '../../types';

/** Impactos que se resaltan en rojo. Se compara por etiqueta porque el
 *  administrador puede renombrar o agregar niveles cuando quiera. */
const IMPACTOS_CRITICOS = ['alto', 'critico', 'crítico'];

export function ValorCampo({
  valor,
  esImpacto = false,
}: {
  valor: ValorDesvio | undefined;
  /** El campo cumple el rol IMPACT: se muestra como etiqueta de color. */
  esImpacto?: boolean;
}) {
  if (!valor?.label) return <span className="text-slate-300">—</span>;

  if (!esImpacto) return <>{valor.label}</>;

  const critico = IMPACTOS_CRITICOS.includes(valor.label.toLowerCase());
  return <Badge tono={critico ? 'rojo' : 'ambar'}>{valor.label}</Badge>;
}
