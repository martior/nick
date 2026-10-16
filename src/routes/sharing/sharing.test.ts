/**
 * Sharing tests.
 * @module routes/sharing/sharing
 */

// External imports
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

// Internal imports
import app from '../../app';
import config from '../../helpers/config/config';
import jobs from '../../helpers/jobs/jobs';
import {
  createDocument,
  createUser,
  testRequest,
} from '../../helpers/tests/tests';
import models from '../../models';

const token =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImZ1bGxuYW1lIjoiQWRtaW4iLCJpYXQiOjE2NDkzMTI0NDl9.RS1Ny_r0v7vIylFfK6q0JVJrkiDuTOh9iG9IL8xbzAk';

/**
 * Get the allowed users, groups and roles from the catalog
 * @method allowed
 * @param {string} uuid Uuid of the document.
 * @returns {Promise<string[]>} Allowed users, groups and roles.
 */
async function allowed(uuid: string): Promise<string[]> {
  const row = await global.txn!('catalog').where({ document: uuid }).first();
  return row._allowedUsersGroupsRoles;
}

/**
 * Post sharing data
 * @method share
 * @param {string} path Path of the document.
 * @param {Object} body Sharing data.
 * @returns {Promise<void>}
 */
async function share(path: string, body: any): Promise<void> {
  await request(app)
    .post(`${path}/@sharing`)
    .set('Accept', 'application/json')
    .set('Authorization', `Bearer ${token}`)
    .send(body)
    .expect(204);
}

describe('Sharing', () => {
  it('should get sharing information', () => testRequest(app, 'sharing/get'));

  it('should get sharing information with search', () =>
    testRequest(app, 'sharing/get_search'));

  it('should set new sharing information', () =>
    testRequest(app, 'sharing/post'));

  it('should reindex the permissions of the subtree', async () => {
    const Document = models.get('Document');
    const User = models.get('User');
    await User.create(
      { id: 'jane', fullname: 'Jane', password: 'secret' },
      {},
      global.txn!,
    );
    const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
    const team = await createDocument(
      '0f2c9a41-6d3e-4c55-8f6a-2b7d9e1c4a01',
      news,
      'team',
      'Folder',
    );
    const page = await createDocument(
      '0f2c9a41-6d3e-4c55-8f6a-2b7d9e1c4a02',
      team,
      'page',
      'Page',
    );
    expect(await allowed(page.uuid)).not.toContain('user:jane');

    // Grant a local role on a parent
    await share('/news', {
      entries: [{ id: 'jane', type: 'user', roles: { Editor: true } }],
      inherit: true,
    });
    expect(await allowed(team.uuid)).toContain('user:jane');
    expect(await allowed(page.uuid)).toContain('user:jane');

    // Block inheritance below the parent
    await share('/news/team', { entries: [], inherit: false });
    expect(await allowed(team.uuid)).not.toContain('user:jane');
    expect(await allowed(page.uuid)).not.toContain('user:jane');

    // Restore inheritance and revoke the role
    await share('/news/team', { entries: [], inherit: true });
    expect(await allowed(page.uuid)).toContain('user:jane');
    await share('/news', {
      entries: [{ id: 'jane', type: 'user', roles: { Editor: false } }],
      inherit: true,
    });
    expect(await allowed(page.uuid)).not.toContain('user:jane');
  });

  it('should reindex large subtrees in a job', async () => {
    const Job = models.get('Job');
    const check = vi.spyOn(jobs, 'check').mockResolvedValue(undefined);
    config.settings.reindexSecurityLimit = 1;
    await share('/events', { entries: [], inherit: false });
    delete config.settings.reindexSecurityLimit;

    const job = await Job.fetchOne({ status: 'created' }, {}, global.txn!);
    expect(job.params).toEqual({
      action: 'reindex_security',
      path: '/events',
    });
    expect(check).toHaveBeenCalled();
    check.mockRestore();
  });

  it('should accept partial sharing data', async () => {
    const Document = models.get('Document');
    await share('/news', {});
    await share('/news', { inherit: false });
    const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
    expect(news.inherit_roles).toBe(false);
    await share('/news', {
      entries: [
        {
          id: 'admin',
          type: 'user',
          roles: { NoSuchRole: true, Reader: true },
        },
      ],
    });
    const roles = await global.txn!('user_role_document').where({
      document: news.uuid,
    });
    expect(roles.map((role: any) => role.role)).toEqual(['Reader']);
  });

  it('should replace the roles of a principal with an entry', async () => {
    const Document = models.get('Document');
    await createUser('jane');
    const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
    const roles = async () =>
      (
        await global.txn!('user_role_document').where({
          document: news.uuid,
          user: 'jane',
        })
      )
        .map((role: any) => role.role)
        .sort();
    const entry = (roles: any) => ({
      entries: [{ id: 'jane', type: 'user', roles }],
    });

    await share('/news', entry({ Reader: true, Contributor: true }));
    expect(await roles()).toStrictEqual(['Contributor', 'Reader']);
    await share('/news', entry({ Editor: true }));
    expect(await roles()).toStrictEqual(['Editor']);
    await share('/news', entry({ Editor: false }));
    expect(await roles()).toStrictEqual([]);
  });

  it('should share with all authenticated users', async () => {
    const Document = models.get('Document');
    const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
    await createDocument(
      '0123abcd-0000-4000-8000-000000000401',
      news,
      'members-only',
      'Page',
    );
    const jane = await createUser('jane');
    const get = (path: string, auth?: string) => {
      const req = request(app).get(path).set('Accept', 'application/json');
      return auth ? req.set('Authorization', `Bearer ${auth}`) : req;
    };

    // The group is always listed
    const sharing = await get('/news/members-only/@sharing', token).expect(200);
    expect(
      sharing.body.entries.find(
        (entry: any) => entry.id === 'AuthenticatedUsers',
      ),
    ).toStrictEqual({
      id: 'AuthenticatedUsers',
      title: 'Logged-in users',
      roles: {
        Anonymous: false,
        Authenticated: false,
        Owner: false,
        Reader: false,
        Contributor: false,
        Editor: false,
        Reviewer: false,
        Administrator: false,
      },
      type: 'group',
      disabled: false,
    });

    await get('/news/members-only', jane).expect(401);
    await share('/news/members-only', {
      entries: [
        { id: 'AuthenticatedUsers', type: 'group', roles: { Reader: true } },
      ],
    });
    await get('/news/members-only', jane).expect(200);
    await get('/news/members-only').expect(401);
    const search = await get('/@search?path.query=/news/members-only', jane);
    expect(search.body.items_total).toBe(1);
  });

  it('should refuse invalid sharing data', async () => {
    const post = (body: any) =>
      request(app)
        .post('/news/@sharing')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${token}`)
        .send(body);
    await post({ inherit: 'yes' }).expect(400);
    await post({ entries: 'admin' }).expect(400);
    await post({ entries: [{ id: 'admin', type: 'robot', roles: {} }] }).expect(
      400,
    );
    await post({ entries: [{ id: 'admin', type: 'user' }] }).expect(400);
  });

  it('should refuse roles for unknown users and groups', async () => {
    const post = (body: any) =>
      request(app)
        .post('/news/@sharing')
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${token}`)
        .send(body);
    for (const type of ['user', 'group']) {
      await post({
        inherit: false,
        entries: [
          { id: 'admin', type: 'user', roles: { Reader: true } },
          { id: 'nobody', type, roles: { Reader: true } },
        ],
      }).expect(400);
    }

    // Nothing is changed
    const res = await request(app)
      .get('/news/@sharing')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.inherit).toBe(true);
    const admin = res.body.entries.find((entry: any) => entry.id === 'admin');
    expect(admin?.roles?.Reader ?? false).toBe(false);
    expect(res.body.entries.some((entry: any) => entry.id === 'nobody')).toBe(
      false,
    );
  });

  it('should list principals with local roles', async () => {
    const Document = models.get('Document');
    await createUser('jane');
    const news = await Document.fetchOne({ path: '/news' }, {}, global.txn!);
    await createDocument(
      '0f2c9a41-6d3e-4c55-8f6a-2b7d9e1c4a03',
      news,
      'child',
      'Page',
    );
    await share('/news', {
      entries: [{ id: 'jane', type: 'user', roles: { Reader: true } }],
    });
    const get = (path: string) =>
      request(app)
        .get(`${path}/@sharing`)
        .set('Accept', 'application/json')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

    const entries = (await get('/news')).body.entries;
    expect(entries.map((entry: any) => entry.disabled)).toEqual([false, false]);
    expect(entries.map((entry: any) => entry.id)).toEqual([
      'AuthenticatedUsers',
      'jane',
    ]);
    expect(entries[1].roles.Reader).toBe(true);

    const child = (await get('/news/child')).body.entries;
    expect(child[1].roles.Reader).toBe('acquired');

    // Search by id
    const search = await request(app)
      .get('/news/@sharing?search=adm')
      .set('Accept', 'application/json')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(search.body.entries[0].disabled).toBe(true);
    expect(search.body.entries.map((entry: any) => entry.id)).toEqual([
      'admin',
      'Administrators',
      'AuthenticatedUsers',
      'jane',
    ]);
  });
});
