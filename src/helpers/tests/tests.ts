/**
 * Test.
 * @module helpers/tests/tests
 */

// Type imports
import type { AllMethods } from 'supertest/types';

// External imports
import { indexOf, isEmpty } from 'es-toolkit/compat';
import { Application } from 'express';
import fs from 'fs';
import { createHmac } from 'node:crypto';
import request, { Response } from 'supertest';
import { expect } from 'vitest';

// Internal imports
import { addToken } from '../auth/auth';
import config from '../config/config';
import models from '../../models';

interface FileData {
  request: string;
  headers: { [key: string]: string };
  body: any;
}

interface RequestData {
  method: AllMethods;
  url: string;
  reqHeaders: { [key: string]: string };
  reqBody: any;
}

interface ResponseData {
  status: number;
  resHeaders: { [key: string]: string };
  resBody: any;
}

/**
 * Read file
 * @method readFile
 * @param {string} filename Filename to read
 * @returns {FileData} Object with request, headers and body of the file
 */
function readFile(filename: string): FileData {
  // Read request file
  const data: string[] = fs
    .readFileSync(
      `${process.cwd()}/docs/rest-api/endpoints/examples/${filename}`,
    )
    .toString()
    .split(/\r?\n/);

  // Get method, url and headers from request
  const request = data[0];
  const headerLength = indexOf(data, '') || data.length;
  const headers = Object.fromEntries(
    data.slice(1, headerLength).map((header) => header.split(': ')),
  );

  // Get body from request
  const body =
    data.length - 1 > headerLength
      ? headers['Content-Type'] === 'application/json' ||
        headers['Accept'] === 'application/json'
        ? JSON.parse(data.slice(headerLength + 1).join('\n'))
        : data.slice(headerLength + 1).join('\n')
      : null;

  return {
    request,
    headers,
    body,
  };
}

/**
 * Read request
 * @method readReq
 * @param {string} filename Filename to read
 * @returns {RequestData} Object with method, url, headers and body of the file
 */
function readReq(filename: string): RequestData {
  const data = readFile(`${filename}.req`);
  const [method, url] = data.request.split(' ');
  return {
    method: method.toLowerCase() as AllMethods,
    url,
    reqHeaders: data.headers,
    reqBody: data.body,
  };
}

/**
 * Read response
 * @method readRes
 * @param {string} filename Filename to read
 * @returns {ResponseData} Object with status, headers and body of the file
 */
function readRes(filename: string): ResponseData {
  const data = readFile(`${filename}.res`);
  const [, status] = data.request.split(' ');
  return {
    status: parseInt(status, 10),
    resHeaders: data.headers,
    resBody: data.body,
  };
}

/**
 * Test request
 * @method testRequest
 * @param {Application} app Express App object
 * @param {string} filename Filename to read
 * @returns {request.Test} Test object
 */
export function testRequest(app: Application, filename: string): request.Test {
  const { method, url, reqHeaders, reqBody } = readReq(filename);
  const { status, resBody } = readRes(filename);

  // Do the call
  const result = request(app)
    [method as AllMethods](url)
    .set(reqHeaders)
    .send(reqBody);

  // Check result
  if (resBody) {
    return result
      .expect(status)
      .expect((res: Response) =>
        isEmpty(res.body)
          ? expect(res.text).toStrictEqual(resBody)
          : expect(res.body).toStrictEqual(resBody),
      );
  } else {
    return result.expect(status);
  }
}

/**
 * Create a user with global roles and return a valid token for the user
 * @method createUser
 * @param {string} id Id of the user.
 * @param {string[]} roles Global roles of the user.
 * @returns {Promise<string>} Token of the user.
 */
export async function createUser(
  id: string,
  roles: string[] = [],
): Promise<string> {
  const User = models.get('User');
  const user = await User.create(
    { id, fullname: id, password: 'secret', email: `${id}@example.com` },
    {},
    global.txn!,
  );
  await Promise.all(
    roles.map((role) => user.$relatedQuery('_roles', global.txn!).relate(role)),
  );

  // Sign a token, jwt.sign is mocked in the tests
  const encode = (data: any) =>
    Buffer.from(JSON.stringify(data)).toString('base64url');
  const content = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({
    sub: id,
    fullname: id,
    iat: 1649312449,
  })}`;
  const token = `${content}.${createHmac('sha256', config.settings.secret)
    .update(content)
    .digest('base64url')}`;
  await addToken(user, token, global.txn!);
  return token;
}

/**
 * Create and index a document
 * @method createDocument
 * @param {string} uuid Uuid of the document.
 * @param {Object} parent Parent document.
 * @param {string} id Id of the document.
 * @param {string} type Type of the document.
 * @param {Object} fields Other fields of the document.
 * @returns {Promise<Object>} Document.
 */
export async function createDocument(
  uuid: string,
  parent: any,
  id: string,
  type: string,
  fields: any = {},
): Promise<any> {
  const Document = models.get('Document');
  const document: any = await Document.create(
    {
      uuid,
      parent: parent.uuid,
      id,
      path: `${parent.path === '/' ? '' : parent.path}/${id}`,
      position_in_parent: 99,
      version: 0,
      owner: 'admin',
      type,
      workflow_state: 'private',
      workflow_history: JSON.stringify([]),
      lock: { locked: false, stealable: true },
      json: { title: id },
      ...fields,
    },
    {},
    global.txn!,
  );
  await document.index(global.txn!);
  return document;
}
