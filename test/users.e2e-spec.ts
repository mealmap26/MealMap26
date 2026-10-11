import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';

describe('Administración de roles (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  const password = 'password123';
  const anaEmail = 'ana@example.com';
  const unknownId = '00000000-0000-4000-8000-000000000000';

  let adminToken: string;
  let adminId: string;
  let anaToken: string;
  let anaId: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  const login = async (email: string) => {
    const res = await http()
      .post('/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken as string;
  };

  beforeAll(async () => {
    ({ app } = await createTestApp());

    await http()
      .post('/seed')
      .set('x-seed-key', process.env.SEED_KEY as string)
      .expect(201);
    const adminLogin = await http()
      .post('/auth/login')
      .send({
        email: process.env.ADMIN_EMAIL,
        password: process.env.ADMIN_PASSWORD,
      })
      .expect(200);
    adminToken = adminLogin.body.accessToken;

    const created = await http()
      .post('/auth/register')
      .send({ email: anaEmail, password })
      .expect(201);
    anaId = created.body.id;
    anaToken = await login(anaEmail);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('permisos', () => {
    it('responde 401 sin token', async () => {
      await http().get('/users').expect(401);
      await http()
        .patch(`/users/${anaId}/role`)
        .send({ role: 'ADMIN' })
        .expect(401);
    });

    it('un USER recibe 403 en ambos endpoints', async () => {
      await http().get('/users').set(auth(anaToken)).expect(403);
      await http()
        .patch(`/users/${anaId}/role`)
        .set(auth(anaToken))
        .send({ role: 'ADMIN' })
        .expect(403);
    });
  });

  describe('GET /users', () => {
    it('el ADMIN lista los usuarios sin la contraseña ni el secreto del 2FA', async () => {
      const res = await http().get('/users').set(auth(adminToken)).expect(200);

      const emails = res.body.map((u: { email: string }) => u.email);
      expect(emails).toEqual([process.env.ADMIN_EMAIL, anaEmail]);
      for (const user of res.body) {
        expect(Object.keys(user).sort()).toEqual(
          ['createdAt', 'email', 'id', 'role', 'twoFAEnabled'].sort(),
        );
      }
      const admin = res.body.find(
        (u: { email: string }) => u.email === process.env.ADMIN_EMAIL,
      );
      expect(admin.role).toBe('ADMIN');
      adminId = admin.id;
    });
  });

  describe('PATCH /users/:id/role', () => {
    it('promueve a un USER a ADMIN y aplica desde su siguiente login', async () => {
      const res = await http()
        .patch(`/users/${anaId}/role`)
        .set(auth(adminToken))
        .send({ role: 'ADMIN' })
        .expect(200);
      expect(res.body).toMatchObject({
        id: anaId,
        email: anaEmail,
        role: 'ADMIN',
      });
      expect(res.body).not.toHaveProperty('password');

      // El token viejo todavía dice USER
      await http().get('/_probe/admin').set(auth(anaToken)).expect(403);

      const newToken = await login(anaEmail);
      await http().get('/_probe/admin').set(auth(newToken)).expect(200);
    });

    it('enviar el mismo rol responde 200 sin cambios', async () => {
      const res = await http()
        .patch(`/users/${anaId}/role`)
        .set(auth(adminToken))
        .send({ role: 'ADMIN' })
        .expect(200);
      expect(res.body.role).toBe('ADMIN');
    });

    it('lo vuelve a dejar como USER', async () => {
      const res = await http()
        .patch(`/users/${anaId}/role`)
        .set(auth(adminToken))
        .send({ role: 'USER' })
        .expect(200);
      expect(res.body.role).toBe('USER');

      const newToken = await login(anaEmail);
      await http().get('/_probe/admin').set(auth(newToken)).expect(403);
    });

    it('responde 404 si el usuario no existe', async () => {
      const res = await http()
        .patch(`/users/${unknownId}/role`)
        .set(auth(adminToken))
        .send({ role: 'ADMIN' })
        .expect(404);
      expect(res.body.message).toBe('Usuario no encontrado');
    });

    it('responde 400 con un rol inválido', async () => {
      await http()
        .patch(`/users/${anaId}/role`)
        .set(auth(adminToken))
        .send({ role: 'SUPERADMIN' })
        .expect(400);
    });

    it('responde 400 si el id no es un UUID', async () => {
      await http()
        .patch('/users/no-es-uuid/role')
        .set(auth(adminToken))
        .send({ role: 'ADMIN' })
        .expect(400);
    });

    it('responde 400 si el ADMIN intenta cambiar su propio rol', async () => {
      const res = await http()
        .patch(`/users/${adminId}/role`)
        .set(auth(adminToken))
        .send({ role: 'USER' })
        .expect(400);
      expect(res.body.message).toBe('No puedes cambiar tu propio rol');
    });
  });

  it('PATCH /users/me/macros sigue funcionando (no choca con /users/:id/role)', async () => {
    await http()
      .patch('/users/me/macros')
      .set(auth(anaToken))
      .send({ dailyCalories: 2000 })
      .expect(200);
  });
});
