/**
 * Translations tests.
 * @module routes/translations/translations
 */

// External imports
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// Internal imports
import app from '../../app';
import { adminToken, createUserWithToken } from '../../helpers/tests/tests';
import { Document } from '../../models/document/document';

const en = '3e9f2a1b-4c5d-4e6f-8a7b-9c0d1e2f3a01';
const nl = '3e9f2a1b-4c5d-4e6f-8a7b-9c0d1e2f3a02';
const hidden = '3e9f2a1b-4c5d-4e6f-8a7b-9c0d1e2f3a03';

/**
 * Send a request as admin
 * @method admin
 * @param {request.Test} req Request.
 * @returns {request.Test} Request.
 */
const admin = (req: request.Test) =>
  req
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${adminToken}`);

/**
 * Add a published english page with a private dutch translation and a
 * private page, and an editor of the english page.
 * @method setup
 * @returns {Promise<string>} Token of the editor.
 */
async function setup(): Promise<string> {
  await admin(request(app).post('/news'))
    .send({ '@type': 'Page', id: 'en', uuid: en, language: 'en', title: 'En' })
    .expect(201);
  await admin(request(app).post('/news/en/@workflow/publish')).expect(200);
  await admin(request(app).post('/news'))
    .send({
      '@type': 'Page',
      id: 'nl',
      uuid: nl,
      language: 'nl',
      title: 'Nl',
      translation_of: en,
    })
    .expect(201);
  await admin(request(app).post('/'))
    .send({ '@type': 'Page', id: 'hidden', uuid: hidden, title: 'Hidden' })
    .expect(201);
  const token = await createUserWithToken('editor');
  await admin(request(app).post('/news/en/@sharing'))
    .send({
      entries: [{ id: 'editor', type: 'user', roles: { Editor: true } }],
      inherit: true,
    })
    .expect(204);
  return token;
}

describe('Translations', () => {
  it('should only list translations the user can view', async () => {
    await setup();
    const ids = (res: request.Response) =>
      res.body.items.map((item: any) => item['@id']);

    // Anonymous
    const anonymous = await request(app)
      .get('/news/en/@translations')
      .set('Accept', 'application/json')
      .expect(200);
    expect(ids(anonymous)).toEqual(['http://localhost:8080/news/en']);

    // Admin
    const res = await admin(request(app).get('/news/en/@translations')).expect(
      200,
    );
    expect(ids(res).sort()).toEqual([
      'http://localhost:8080/news/en',
      'http://localhost:8080/news/nl',
    ]);
  });

  it('should not link or unlink items the user can not modify', async () => {
    const token = await setup();
    const editor = (req: request.Test) =>
      req
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${token}`);

    // Link a page the editor can't view
    await editor(request(app).post('/news/en/@translations'))
      .send({ id: '/hidden' })
      .expect(404);
    expect(
      (await Document.fetchById(hidden, {}, global.txn!)).translation_group,
    ).not.toBe(en);

    // Unlink a translation the editor can't view
    await editor(request(app).delete('/news/en/@translations'))
      .send({ language: 'nl' })
      .expect(404);
    expect(
      (await Document.fetchById(nl, {}, global.txn!)).translation_group,
    ).toBe(en);
  });
});
