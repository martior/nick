/**
 * Client.
 * @module client
 */

// Type imports
import type { Request } from './types';

// External imports
import { NextFunction, Response } from 'express';

// Internal imports
import { RequestException } from './helpers/error/error';
import { initI18n } from './helpers/i18n/i18n';
import { initProfiles } from './helpers/profiles/profiles';
import { callHandler } from './helpers/handler/handler';
import { i18n } from './middleware/i18n/i18n';
import models from './models';
import routes from './routes';

/**
 * Client component
 * @class Client
 */
export class Client {
  /**
   * Initialize.
   * @method initialize
   * @param {Object} Request object.
   * @static
   * @returns {Client} New client object.
   */
  static initialize = ({ token: initToken, apiPath }: any): any => {
    initI18n();

    /**
     * Call the handler of the route with the given client name.
     * @method call
     * @param {string} name Client name of the route.
     * @param {Object} args Arguments of the call.
     * @returns {Promise<Object>} Object with the data of the response.
     */
    const call = async (
      name: string,
      {
        token,
        path,
        data,
        locktoken,
        query,
        params,
        headers,
        ...rest
      } = {} as any,
    ) => {
      // The profiles register the models and the routes
      await initProfiles();
      const route = routes.routes.find((route: any) => route.client === name);
      if (!route) {
        throw new Error(`Unknown client method: ${name}`);
      }

      const req = {
        token: initToken || token,
        apiPath,
        documentPath: path || '/',
        body: data,
        query,
        params: {
          ...(params ? params : {}),
          ...rest,
        },
        headers: {
          ...headers,
          ...(locktoken ? { 'lock-token': locktoken } : {}),
        },
        // A client has no Accept-Language, so the default language is used
        acceptsLanguages: () => false,
      } as unknown as Request;

      await i18n(req, {} as Response, (() => {}) as NextFunction);

      const trx = await models.get('Document').startTransaction();

      try {
        const res = await callHandler(req, trx, route, () => {});

        // Try to commit the transaction
        try {
          await trx.commit();
        } catch (_err) {
          throw new RequestException(500, {
            message: req.i18n('Transaction error.'),
          });
        }

        // Call the handler
        return {
          data: res.json,
        };
      } catch (err) {
        // Rollback transaction
        await trx.rollback();
        throw err;
      }
    };

    // The methods are named after the routes, which are only known once the
    // profiles are initialized, so they are looked up when they are called
    return new Proxy(new Client(), {
      get: (target: any, name: string | symbol) =>
        typeof name !== 'string' || name === 'then' || name in target
          ? target[name]
          : (args?: any) => call(name, args),
    });
  };
}
