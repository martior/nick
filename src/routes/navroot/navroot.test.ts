/**
 * Navroot tests.
 * @module routes/navroot/navroot
 */

// External imports
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// Internal imports
import app from '../../app';
import { adminToken, testRequest } from '../../helpers/tests/tests';

describe('Navroot', () => {
  it('should get the navroot', () => testRequest(app, 'navroot/get'));

  it('should not list items the user can not view', async () => {
    await request(app)
      .post('/')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ '@type': 'Page', id: 'private-page', title: 'Private Page' })
      .expect(201);
    const ids = (res: request.Response) =>
      res.body.navroot.items.map((item: any) => item.id);

    // Anonymous
    const anonymous = await request(app)
      .get('/news/@navroot')
      .set('Accept', 'application/json')
      .expect(200);
    expect(ids(anonymous)).toContain('news');
    expect(ids(anonymous)).not.toContain('private-page');

    // Admin
    const admin = await request(app)
      .get('/news/@navroot')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(ids(admin)).toContain('private-page');
  });
});
