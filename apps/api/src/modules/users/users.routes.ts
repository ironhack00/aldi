/**
 * Endpoints de usuarios: /api/users/* (solo ADMIN).
 *
 * Alcance deliberadamente minimo para el MVP: listar, crear, cambiar rol y
 * activar/desactivar. No hay recuperacion de contrasena ni invitaciones por
 * mail; queda anotado como siguiente paso.
 */
import type { FastifyPluginAsync } from 'fastify';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { hashPassword } from '../../shared/password.js';
import { aUsuarioPublico } from '../auth/auth.service.js';
import { BadRequestError, ConflictError, NotFoundError } from '../../shared/errors.js';

const idParams = z.object({ id: z.string().cuid() });

const crearUsuarioSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(80),
  password: z.string().min(8, 'Minimo 8 caracteres'),
  role: z.nativeEnum(Role).default(Role.OPERADOR),
});

const actualizarUsuarioSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  role: z.nativeEnum(Role).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export const usersRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', app.authorize(Role.ADMIN));

  app.get('/', async () => {
    const usuarios = await prisma.user.findMany({ orderBy: { name: 'asc' } });
    return { users: usuarios.map(aUsuarioPublico) };
  });

  app.post('/', async (request, reply) => {
    const input = crearUsuarioSchema.parse(request.body);
    const email = input.email.toLowerCase().trim();

    const existe = await prisma.user.findUnique({ where: { email } });
    if (existe) throw new ConflictError('Ya existe un usuario con ese email');

    const usuario = await prisma.user.create({
      data: {
        email,
        name: input.name,
        role: input.role,
        passwordHash: await hashPassword(input.password),
      },
    });

    return reply.status(201).send({ user: aUsuarioPublico(usuario) });
  });

  app.patch('/:id', async (request) => {
    const { id } = idParams.parse(request.params);
    const input = actualizarUsuarioSchema.parse(request.body);

    const usuario = await prisma.user.findUnique({ where: { id } });
    if (!usuario) throw new NotFoundError('Usuario');

    // Un admin no puede dejarse sin acceso a si mismo por error.
    const seEstaModificandoASiMismo = request.auth!.sub === id;
    if (seEstaModificandoASiMismo && (input.isActive === false || input.role !== undefined)) {
      throw new BadRequestError('No podes cambiar tu propio rol ni desactivarte');
    }

    const actualizado = await prisma.user.update({
      where: { id },
      data: {
        name: input.name,
        role: input.role,
        isActive: input.isActive,
        passwordHash: input.password ? await hashPassword(input.password) : undefined,
      },
    });

    // Al desactivar o cambiar el rol se cortan las sesiones abiertas: el
    // access token viejo seguiria diciendo el rol anterior hasta expirar.
    if (input.isActive === false || input.role) {
      await prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    return { user: aUsuarioPublico(actualizado) };
  });
};
