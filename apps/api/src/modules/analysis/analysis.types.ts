/**
 * Contrato del modulo de analisis.
 *
 * Toda la aplicacion habla con esta interfaz, nunca con un motor concreto.
 * Hoy hay tres implementaciones: `local` (metricas calculadas), `openai`
 * (ChatGPT) y `codex` (pendiente de conectar). Cambiar de una a otra es cambiar una variable de
 * entorno; ni el frontend ni el resto del backend se enteran.
 */
import type { ResumenMetricas } from '../metrics/metrics.service.js';

export type MotorAnalisis = 'local' | 'codex' | 'openai';

/** Datos que se le entregan al motor para que razone. */
export interface ContextoAnalisis {
  resumen: ResumenMetricas;
  /** Muestra de desvios recientes, ya aplanados y anonimizados. */
  muestra: {
    code: string;
    occurredOn: string;
    raisedOn: string;
    diasHastaDeteccion: number;
    atributos: Record<string, string>;
  }[];
}

export interface RespuestaAnalisis {
  /** Texto a mostrar al usuario. */
  answer: string;
  /** Que motor contesto: el frontend lo muestra como etiqueta. */
  provider: MotorAnalisis;
  /** Cifras que respaldan la respuesta, para que no sea una afirmacion suelta. */
  evidence?: { label: string; value: string }[];
}

export interface AIProvider {
  readonly name: MotorAnalisis;
  analizar(pregunta: string, contexto: ContextoAnalisis): Promise<RespuestaAnalisis>;
}
