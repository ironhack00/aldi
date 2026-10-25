/**
 * Carga inicial de la base.
 *
 * Toma TODO lo que en el prototipo estaba hardcodeado en constantes de
 * JavaScript y lo inserta como datos administrables:
 *
 *   flujo / actividades / problemas / causas / especies / impactos
 *     -> catalogos y items
 *   los campos del formulario de registro
 *     -> field_definitions
 *
 * Es idempotente: se puede correr varias veces sin duplicar nada.
 * Uso: npm run db:seed
 */
import 'dotenv/config';
import { FieldRole, FieldType, PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PASSWORD_DEMO = process.env.SEED_PASSWORD ?? 'Demo1234!';

// -----------------------------------------------------------------------------
//  Datos de dominio (los del prototipo, ahora como semilla editable)
// -----------------------------------------------------------------------------

/**
 * Etapas del flujo productivo, en orden. La posicion define la "distancia en
 * etapas" entre donde se origino el desvio y donde se detecto.
 */
const FLUJO = [
  'Stock de jaulas',
  'Armado de jaula',
  'Cambio de jaula',
  'Inoculacion',
  'Dieta',
  'Transferencia',
  'Cambio de dieta',
  'Colecta',
  'Descarte',
  'Lavadero',
];

/** Actividades fuera de la secuencia: existen, pero no se les mide distancia. */
const ACTIVIDADES_FUERA_DE_FLUJO = ['Stock cocina'];

const ESPECIES = [
  'S. frugiperda',
  'S. cosmioides',
  'R. nu',
  'D. saccharalis',
  'A. gemmatalis',
  'C. includens',
  'H. zea',
];

const IMPACTOS = ['Sin impacto', 'Bajo', 'Medio', 'Alto', 'Critico'];

const PROBLEMAS: Record<string, string[]> = {
  'Actividad no realizada': [
    'Inoculacion no realizada',
    'Dieta no realizada',
    'Transferencia no realizada',
    'Colecta no realizada',
  ],
  'Target no alcanzado': [
    'Target de inoculacion no alcanzado',
    'Target de transferencia no alcanzado',
    'Target de colecta no alcanzado',
  ],
  Datos: ['Dato no registrado', 'Dato incorrecto', 'Dato incompleto'],
  'Proceso no seguido': ['Error operativo', 'No sigue receta', 'No sigue pasos de WI'],
  Contaminacion: [
    'Contaminacion de dieta',
    'Contaminacion tarros de inoculacion',
    'Contaminacion pupas',
  ],
  'Insumo no disponible': ['Falta de stock', 'Insumo vencido', 'Cantidad insuficiente'],
  'Problema de equipos operativos': ['Equipo no funciona', 'Equipo funciona parcialmente'],
  'Problema de app o sistema': [
    'App no disponible',
    'Wi-Fi no disponible',
    'Error de automatizacion',
  ],
};

const CAUSAS: Record<string, string[]> = {
  Supervision: ['Falta de supervision operativa', 'Falta de supervision de datos'],
  'Planificacion y ejecucion': [
    'Actividad omitida',
    'Actividad realizada fuera de tiempo',
    'Priorizacion de otra actividad',
  ],
  Estandarizacion: ['Falta de estandar visual / WI'],
  'Recursos / disponibilidad': ['Ausencia de personal', 'Dotacion insuficiente', 'Falta de stock'],
  'Contaminacion / higiene': [
    'Lavado insuficiente',
    'Mala higiene durante el proceso',
    'Manipulacion inadecuada',
  ],
  Digitalizacion: ['App no disponible', 'Wi-Fi no disponible', 'Error de automatizacion'],
  'Pendiente de analisis': ['Investigacion pendiente'],
};

// -----------------------------------------------------------------------------
//  Helpers idempotentes
// -----------------------------------------------------------------------------

async function upsertCatalogo(
  key: string,
  name: string,
  description: string,
  hierarchical: boolean,
) {
  return prisma.catalog.upsert({
    where: { key },
    create: { key, name, description, hierarchical, isSystem: true },
    update: { name, description },
  });
}

/** Crea un item si no existe (comparando por catalogo + padre + etiqueta). */
async function upsertItem(
  catalogId: string,
  label: string,
  opciones: { parentId?: string | null; order?: number; flowPosition?: number | null } = {},
) {
  const existente = await prisma.catalogItem.findFirst({
    where: { catalogId, parentId: opciones.parentId ?? null, label },
  });
  if (existente) {
    return prisma.catalogItem.update({
      where: { id: existente.id },
      data: { order: opciones.order ?? existente.order, flowPosition: opciones.flowPosition ?? existente.flowPosition },
    });
  }
  return prisma.catalogItem.create({
    data: {
      catalogId,
      label,
      parentId: opciones.parentId ?? null,
      order: opciones.order ?? 0,
      flowPosition: opciones.flowPosition ?? null,
    },
  });
}

async function upsertCampo(data: {
  key: string;
  label: string;
  type: FieldType;
  order: number;
  role?: FieldRole;
  catalogId?: string | null;
  parentFieldId?: string | null;
  required?: boolean;
  showInTable?: boolean;
  helpText?: string | null;
}) {
  const { key, ...resto } = data;
  return prisma.fieldDefinition.upsert({
    where: { key },
    create: { key, isSystem: true, ...resto },
    // En update no se toca `type`: cambiarlo invalidaria los valores guardados.
    update: {
      label: resto.label,
      order: resto.order,
      role: resto.role,
      catalogId: resto.catalogId,
      parentFieldId: resto.parentFieldId,
      required: resto.required,
      showInTable: resto.showInTable,
      helpText: resto.helpText,
    },
  });
}

// -----------------------------------------------------------------------------
//  Seed
// -----------------------------------------------------------------------------

async function main() {
  console.log('Cargando datos iniciales...\n');

  // --- 1. Usuarios demo ------------------------------------------------------
  const passwordHash = await bcrypt.hash(PASSWORD_DEMO, 12);
  const usuarios = [
    { email: 'admin@demo.com', name: 'Admin Demo', role: Role.ADMIN },
    { email: 'supervisor@demo.com', name: 'Supervisor Demo', role: Role.SUPERVISOR },
    { email: 'operador@demo.com', name: 'Operador Demo', role: Role.OPERADOR },
  ];

  for (const u of usuarios) {
    await prisma.user.upsert({
      where: { email: u.email },
      create: { ...u, passwordHash },
      update: { name: u.name, role: u.role, passwordHash, isActive: true },
    });
  }
  console.log(`  Usuarios: ${usuarios.map((u) => u.email).join(', ')}`);

  // --- 2. Catalogos ----------------------------------------------------------
  const catActividades = await upsertCatalogo(
    'actividades',
    'Actividades',
    'Etapas del flujo productivo del insectario. El orden define la distancia entre etapas.',
    false,
  );
  const catEspecies = await upsertCatalogo('especies', 'Especies', 'Especies criadas.', false);
  const catProblemas = await upsertCatalogo(
    'problemas',
    'Problemas',
    'Tipo de problema y su especificacion (jerarquico).',
    true,
  );
  const catCausas = await upsertCatalogo(
    'causas',
    'Causas raiz',
    'Categoria de causa raiz y causa especifica (jerarquico).',
    true,
  );
  const catImpactos = await upsertCatalogo(
    'impactos',
    'Impacto',
    'Severidad del desvio.',
    false,
  );

  // Actividades: las del flujo llevan flowPosition; las paralelas, null.
  for (const [indice, label] of FLUJO.entries()) {
    await upsertItem(catActividades.id, label, { order: indice, flowPosition: indice });
  }
  for (const [i, label] of ACTIVIDADES_FUERA_DE_FLUJO.entries()) {
    await upsertItem(catActividades.id, label, { order: FLUJO.length + i, flowPosition: null });
  }
  console.log(`  Actividades: ${FLUJO.length + ACTIVIDADES_FUERA_DE_FLUJO.length}`);

  for (const [i, label] of ESPECIES.entries()) {
    await upsertItem(catEspecies.id, label, { order: i });
  }
  for (const [i, label] of IMPACTOS.entries()) {
    await upsertItem(catImpactos.id, label, { order: i });
  }

  // Jerarquicos: primero el padre, despues sus hijos.
  for (const [i, [padre, hijos]] of Object.entries(PROBLEMAS).entries()) {
    const item = await upsertItem(catProblemas.id, padre, { order: i });
    for (const [j, hijo] of hijos.entries()) {
      await upsertItem(catProblemas.id, hijo, { parentId: item.id, order: j });
    }
  }
  for (const [i, [padre, hijos]] of Object.entries(CAUSAS).entries()) {
    const item = await upsertItem(catCausas.id, padre, { order: i });
    for (const [j, hijo] of hijos.entries()) {
      await upsertItem(catCausas.id, hijo, { parentId: item.id, order: j });
    }
  }
  console.log(`  Problemas: ${Object.keys(PROBLEMAS).length} categorias`);
  console.log(`  Causas: ${Object.keys(CAUSAS).length} categorias`);

  // --- 3. Campos del formulario ---------------------------------------------
  // El orden es el que vera el usuario en la pantalla de registro.
  const campoEspecie = await upsertCampo({
    key: 'especie',
    label: 'Especie',
    type: FieldType.SELECT,
    role: FieldRole.SPECIES,
    catalogId: catEspecies.id,
    required: true,
    order: 0,
  });

  await upsertCampo({
    key: 'lote',
    label: 'Lote',
    type: FieldType.TEXT,
    role: FieldRole.BATCH,
    required: false,
    order: 1,
    helpText: 'Ej. DS-242',
  });

  await upsertCampo({
    key: 'actividadResponsable',
    label: 'Actividad responsable',
    type: FieldType.SELECT,
    role: FieldRole.ACTIVITY_ORIGIN,
    catalogId: catActividades.id,
    required: true,
    order: 2,
    helpText: 'Donde se origino el desvio',
  });

  await upsertCampo({
    key: 'actividadDeteccion',
    label: 'Actividad donde se detecto',
    type: FieldType.SELECT,
    role: FieldRole.ACTIVITY_DETECTION,
    catalogId: catActividades.id,
    required: true,
    order: 3,
  });

  const campoProblema = await upsertCampo({
    key: 'problema',
    label: 'Problema principal',
    type: FieldType.SELECT,
    catalogId: catProblemas.id,
    required: true,
    order: 4,
  });

  // Cascada: la especificacion muestra solo los hijos del problema elegido.
  await upsertCampo({
    key: 'especificacion',
    label: 'Especificacion',
    type: FieldType.SELECT,
    catalogId: catProblemas.id,
    parentFieldId: campoProblema.id,
    required: false,
    order: 5,
  });

  await upsertCampo({
    key: 'impacto',
    label: 'Impacto',
    type: FieldType.SELECT,
    role: FieldRole.IMPACT,
    catalogId: catImpactos.id,
    required: true,
    order: 6,
  });

  const campoCausa = await upsertCampo({
    key: 'causa',
    label: 'Categoria de causa raiz',
    type: FieldType.SELECT,
    catalogId: catCausas.id,
    required: true,
    order: 7,
  });

  await upsertCampo({
    key: 'causaEspecifica',
    label: 'Causa raiz especifica',
    type: FieldType.SELECT,
    catalogId: catCausas.id,
    parentFieldId: campoCausa.id,
    required: false,
    order: 8,
  });

  await upsertCampo({
    key: 'observaciones',
    label: 'Observaciones',
    type: FieldType.TEXTAREA,
    required: false,
    showInTable: false,
    order: 9,
  });

  console.log('  Campos del formulario: 10');

  // --- 4. Desvios de ejemplo -------------------------------------------------
  // Solo si la tabla esta vacia: no queremos pisar datos cargados a mano.
  const yaHayDesvios = await prisma.deviation.count();
  if (yaHayDesvios === 0) {
    await crearDesviosDeEjemplo(campoEspecie.id);
    console.log('  Desvios de ejemplo: 3');
  } else {
    console.log(`  Desvios: ya existian ${yaHayDesvios}, no se agregaron ejemplos`);
  }

  console.log(`\nListo. Password de los usuarios demo: ${PASSWORD_DEMO}\n`);
}

/**
 * Inserta los tres desvios que traia el prototipo, resolviendo los ids de los
 * items por etiqueta (asi el seed no depende de ids generados).
 */
async function crearDesviosDeEjemplo(_campoEspecieId: string) {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'admin@demo.com' } });

  const ejemplos = [
    {
      occurredOn: '2026-10-19',
      raisedOn: '2026-10-21',
      valores: {
        especie: 'D. saccharalis',
        lote: 'DS-241',
        actividadResponsable: 'Inoculacion',
        actividadDeteccion: 'Transferencia',
        problema: 'Actividad no realizada',
        especificacion: 'Inoculacion no realizada',
        impacto: 'Medio',
        causa: 'Supervision',
        causaEspecifica: 'Falta de supervision operativa',
      },
    },
    {
      occurredOn: '2026-10-20',
      raisedOn: '2026-10-20',
      valores: {
        especie: 'C. includens',
        lote: 'CI-108',
        actividadResponsable: 'Dieta',
        actividadDeteccion: 'Dieta',
        problema: 'Contaminacion',
        especificacion: 'Contaminacion de dieta',
        impacto: 'Alto',
        causa: 'Contaminacion / higiene',
        causaEspecifica: 'Mala higiene durante el proceso',
      },
    },
    {
      occurredOn: '2026-10-16',
      raisedOn: '2026-10-19',
      valores: {
        especie: 'H. zea',
        lote: 'HZ-084',
        actividadResponsable: 'Colecta',
        actividadDeteccion: 'Descarte',
        problema: 'Datos',
        especificacion: 'Dato no registrado',
        impacto: 'Bajo',
        causa: 'Planificacion y ejecucion',
        causaEspecifica: 'Actividad omitida',
      },
    },
  ];

  const campos = await prisma.fieldDefinition.findMany({ include: { catalog: true } });
  const porKey = new Map(campos.map((c) => [c.key, c]));

  for (const [indice, ejemplo] of ejemplos.entries()) {
    const filas: { fieldId: string; valueText?: string; catalogItemId?: string }[] = [];

    for (const [key, etiqueta] of Object.entries(ejemplo.valores)) {
      const campo = porKey.get(key);
      if (!campo) continue;

      if (campo.catalogId) {
        const item = await prisma.catalogItem.findFirst({
          where: { catalogId: campo.catalogId, label: etiqueta },
        });
        if (item) filas.push({ fieldId: campo.id, catalogItemId: item.id });
      } else {
        filas.push({ fieldId: campo.id, valueText: etiqueta });
      }
    }

    await prisma.deviation.create({
      data: {
        code: `DEV-${String(indice + 1).padStart(4, '0')}`,
        occurredOn: new Date(`${ejemplo.occurredOn}T00:00:00.000Z`),
        raisedOn: new Date(`${ejemplo.raisedOn}T00:00:00.000Z`),
        createdById: admin.id,
        values: { createMany: { data: filas } },
      },
    });
  }

  // El contador arranca donde terminaron los ejemplos.
  await prisma.counter.upsert({
    where: { key: 'deviation_code' },
    create: { key: 'deviation_code', value: ejemplos.length },
    update: { value: ejemplos.length },
  });
}

main()
  .catch((error) => {
    console.error('\nEl seed fallo:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
