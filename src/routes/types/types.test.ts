/**
 * Types tests.
 * @module routes/types/types
 */

// External imports
import request from 'supertest';
import { describe, expect, it } from 'vitest';

// Internal imports
import app from '../../app';
import { createUser, testRequest } from '../../helpers/tests/tests';

const token =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsImZ1bGxuYW1lIjoiQWRtaW4iLCJpYXQiOjE2NDkzMTI0NDl9.RS1Ny_r0v7vIylFfK6q0JVJrkiDuTOh9iG9IL8xbzAk';

/**
 * Do a request on the types endpoint
 * @method call
 * @param {string} method Http method.
 * @param {string} path Path.
 * @param {string} auth Token.
 * @returns {Object} Request.
 */
function call(
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  auth: string = token,
) {
  const req = request(app)[method](path).set('Accept', 'application/json');
  return auth ? req.set('Authorization', `Bearer ${auth}`) : req;
}

describe('Types', () => {
  it('should return a list of types', () => testRequest(app, 'types/list'));

  it('should return a type', () => testRequest(app, 'types/get'));

  it('should return not found when type not found', () =>
    testRequest(app, 'types/get_notfound'));

  it('should return a list of types in a different language', () =>
    testRequest(app, 'i18n/list'));

  it('should only show types to authenticated users', async () => {
    await call('get', '/@types', '').expect(401);
    await call('get', '/@types/Page', '').expect(401);
    const member = await createUser('member');
    await call('get', '/@types/Page', member).expect(200);
  });

  it('should return the schema as json schema', async () => {
    const res = await call('get', '/@types/Page').expect(200);
    expect(res.headers['content-type']).toMatch(/^application\/json\+schema/);
    expect(res.body.type).toBe('object');
  });

  it('should return a field or a fieldset', async () => {
    expect(
      (await call('get', '/@types/Page/title').expect(200)).body.type,
    ).toBe('string');
    expect(
      (await call('get', '/@types/Page/default').expect(200)).body.fields,
    ).toContain('title');
    await call('get', '/@types/Page/nothing').expect(404);
  });

  it('should add, change and remove fields', async () => {
    const member = await createUser('member');
    await call('post', '/@types/Page', member)
      .send({ factory: 'Text line (String)', title: 'Author' })
      .expect(401);
    await call('post', '/@types/Page')
      .send({ factory: 'label', title: 'Label' })
      .expect(400);

    // Add a fieldset and a required field in it
    expect(
      (
        await call('post', '/@types/Page')
          .send({ factory: 'fieldset', title: 'Extra' })
          .expect(201)
      ).body,
    ).toStrictEqual({
      id: 'extra',
      title: 'Extra',
      description: '',
      fields: [],
    });
    expect(
      (
        await call('post', '/@types/Page')
          .send({
            factory: 'Text line (String)',
            title: 'Author name',
            required: true,
            fieldset_id: 'extra',
          })
          .expect(201)
      ).body,
    ).toStrictEqual({
      type: 'string',
      title: 'Author name',
      description: '',
      factory: 'Text line (String)',
    });
    let schema = (await call('get', '/@types/Page').expect(200)).body;
    expect(schema.properties.author_name.title).toBe('Author name');
    expect(schema.required).toContain('author_name');
    expect(
      schema.fieldsets.find((fieldset: any) => fieldset.id === 'extra').fields,
    ).toStrictEqual(['author_name']);

    // New content needs the required field
    await call('post', '/news')
      .send({ '@type': 'Page', title: 'No author' })
      .expect(400);

    // Change the field
    await call('patch', '/@types/Page/author_name')
      .send({ title: 'Author', required: false })
      .expect(204);
    schema = (await call('get', '/@types/Page').expect(200)).body;
    expect(schema.properties.author_name.title).toBe('Author');
    expect(schema.required).not.toContain('author_name');

    // Behavior fields can't be removed, fields added through the web can
    await call('delete', '/@types/Page/title').expect(404);
    await call('delete', '/@types/Page/extra').expect(204);
    schema = (await call('get', '/@types/Page').expect(200)).body;
    expect(schema.properties.author_name).toBeUndefined();
    expect(
      schema.fieldsets.find((fieldset: any) => fieldset.id === 'extra'),
    ).toBeUndefined();
  });
});
