/**
 * Motor de analisis local (default).
 *
 * No es un modelo de lenguaje: resuelve un conjunto acotado de preguntas
 * frecuentes leyendo las metricas reales de la base. Dos razones para que
 * exista:
 *   1. la demo funciona sin credenciales ni costo por consulta;
 *   2. es el fallback cuando Codex no esta disponible, de modo que la pantalla
 *      nunca queda vacia.
 *
 * A diferencia del prototipo, las cifras no se inventan: cada respuesta viene
 * con la evidencia que la sostiene.
 */
import type { AIProvider, ContextoAnalisis, RespuestaAnalisis } from './analysis.types.js';

/**
 * Una intencion reconocible: las palabras que la disparan y como se responde.
 * `responder` recibe el contexto y la pregunta ya normalizada (sin acentos ni
 * mayusculas), para poder buscar en ella el nombre de un campo.
 */
interface Intencion {
  claves: string[];
  responder: (ctx: ContextoAnalisis, pregunta: string) => RespuestaAnalisis | null;
}

const SUGERENCIAS = [
  '¿Que dia se levantan mas desvios?',
  '¿Cual es la causa mas repetida?',
  '¿Cuanto tardamos en detectar los desvios?',
  '¿Cuantos desvios se detectaron tarde?',
];

const INTENCIONES: Intencion[] = [
  {
    claves: ['dia', 'semana', 'pendiente', 'acumula'],
    responder: ({ resumen }) => {
      const conDatos = resumen.porDiaSemana.filter((d) => d.cantidad > 0);
      if (conDatos.length === 0) return null;

      const maximo = Math.max(...conDatos.map((d) => d.cantidad));
      const empatados = conDatos.filter((d) => d.cantidad === maximo);

      // Con pocos registros el empate es lo normal; decir "el lunes es el dia
      // con mas desvios" cuando lunes, martes y jueves tienen uno cada uno
      // seria una conclusion inventada.
      const answer =
        empatados.length === 1
          ? `${empatados[0]!.dia} concentra la mayor cantidad de levantamientos ` +
            `(${maximo} de ${resumen.totalDesvios}).`
          : `No hay un dia que se destaque: ${listar(empatados.map((d) => d.dia))} ` +
            `empatan con ${maximo} levantamiento/s cada uno, sobre ${resumen.totalDesvios} en total.`;

      return {
        provider: 'local',
        answer,
        evidence: conDatos.map((d) => ({ label: d.dia, value: String(d.cantidad) })),
      };
    },
  },
  {
    claves: ['causa', 'motivo', 'raiz', 'problema', 'repetida', 'frecuente', 'comun'],
    responder: (ctx, texto) => {
      const candidatos = ctx.resumen.topPorCampo.filter((c) => c.items.length > 0);
      if (candidatos.length === 0) return null;

      /**
       * Primero se busca el campo que la pregunta nombra: si preguntan por la
       * causa, hay que mirar el campo "causa", no el que casualmente tenga mas
       * repeticiones. Los campos son dinamicos, asi que la correspondencia se
       * hace comparando las palabras de la pregunta con la etiqueta del campo.
       */
      // Si la pregunta no nombra ningun campo, se cae al de mayor concentracion.
      const elegido =
        buscarCampoNombrado(ctx, texto) ??
        [...candidatos].sort((a, b) => b.items[0]!.cantidad - a.items[0]!.cantidad)[0]!;
      const principal = elegido.items[0]!;

      return {
        provider: 'local',
        answer:
          `En "${elegido.label}" el valor mas repetido es "${principal.label}" ` +
          `con ${principal.cantidad} registro/s.`,
        evidence: elegido.items.map((i) => ({ label: i.label, value: String(i.cantidad) })),
      };
    },
  },
  {
    claves: ['tard', 'demor', 'detect', 'tiempo', 'promedio'],
    responder: ({ resumen }) => {
      if (resumen.promedioDeteccion === null) return null;
      return {
        provider: 'local',
        answer:
          `El tiempo promedio entre que el desvio ocurre y se levanta es de ` +
          `${resumen.promedioDeteccion} dia/s. ${resumen.detectadosTarde} desvio/s ` +
          `se detectaron en una etapa posterior a la responsable y ` +
          `${resumen.detectadosMismoDia} se levantaron el mismo dia.`,
        evidence: [
          { label: 'Promedio (dias)', value: String(resumen.promedioDeteccion) },
          { label: 'Detectados tarde', value: String(resumen.detectadosTarde) },
          { label: 'Mismo dia', value: String(resumen.detectadosMismoDia) },
        ],
      };
    },
  },
  {
    claves: ['cuantos', 'total', 'cantidad'],
    responder: ({ resumen }) => ({
      provider: 'local',
      answer: `Hay ${resumen.totalDesvios} desvio/s registrados.`,
      evidence: [{ label: 'Total', value: String(resumen.totalDesvios) }],
    }),
  },
];

/**
 * Ultimo recurso antes de darse por vencido: si la pregunta nombra alguno de
 * los campos existentes, se responde con su distribucion. Como los campos son
 * dinamicos, esto cubre automaticamente los que el administrador agregue
 * manana sin que haya que tocar este archivo.
 */
function responderPorCampo(
  contexto: ContextoAnalisis,
  texto: string,
): RespuestaAnalisis | null {
  const campo = buscarCampoNombrado(contexto, texto);
  if (!campo) return null;

  const principal = campo.items[0]!;
  return {
    provider: 'local',
    answer:
      `En "${campo.label}" el valor mas repetido es "${principal.label}" ` +
      `con ${principal.cantidad} registro/s.`,
    evidence: campo.items.map((i) => ({ label: i.label, value: String(i.cantidad) })),
  };
}

/** Busca el campo cuya etiqueta aparece mencionada en la pregunta. */
function buscarCampoNombrado(contexto: ContextoAnalisis, texto: string) {
  const palabras = texto.split(/\s+/).filter((p) => p.length >= 4);

  return (
    contexto.resumen.topPorCampo
      .filter((c) => c.items.length > 0)
      .find((c) => {
        const etiqueta = normalizar(c.label);
        return palabras.some((p) => etiqueta.includes(p) || p.includes(etiqueta));
      }) ?? null
  );
}

/** "a, b y c" — para enumerar en castellano sin que quede un array crudo. */
function listar(valores: string[]): string {
  if (valores.length <= 1) return valores[0] ?? '';
  return `${valores.slice(0, -1).join(', ')} y ${valores.at(-1)}`;
}

/** Normaliza para comparar sin acentos ni mayusculas. */
const normalizar = (texto: string): string =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export const localProvider: AIProvider = {
  name: 'local',

  async analizar(pregunta, contexto) {
    const texto = normalizar(pregunta);

    if (contexto.resumen.totalDesvios === 0) {
      return {
        provider: 'local',
        answer: 'Todavia no hay desvios registrados, asi que no hay nada que analizar.',
      };
    }

    for (const intencion of INTENCIONES) {
      if (!intencion.claves.some((clave) => texto.includes(clave))) continue;
      const respuesta = intencion.responder(contexto, texto);
      if (respuesta) return respuesta;
    }

    // Ninguna intencion reconocio la pregunta: ultimo intento por nombre de campo.
    const porCampo = responderPorCampo(contexto, texto);
    if (porCampo) return porCampo;

    return {
      provider: 'local',
      answer: `No pude interpretar la pregunta. Proba con: ${SUGERENCIAS.join(' / ')}`,
    };
  },
};
