/**
 * Lock routes.
 * @module routes/lock/lock
 */

// Type imports
import type { Knex } from 'knex';
import type { Request } from '../../types';

// External imports
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { v4 as uuid } from 'uuid';

// Internal imports
import { RequestException } from '../../helpers/error/error';
import { lockExpired } from '../../helpers/lock/lock';
import { getRootUrl } from '../../helpers/url/url';

dayjs.extend(utc);

export default [
  {
    op: 'get',
    view: '/@lock',
    permission: 'View',
    client: 'getLock',
    cache: 'manage',
    handler: async (req: Request, _trx: Knex.Transaction) => ({
      json: req.document.lockInfo(req.permissions),
      xkeys: [req.document.uuid],
    }),
  },
  {
    op: 'post',
    view: '/@lock',
    permission: 'Modify',
    client: 'createLock',
    cache: 'alter',
    handler: async (req: Request, trx: Knex.Transaction) => {
      const lock = req.document.lock;

      // Check if lock already exists
      if (lock.locked && !lockExpired(req.document)) {
        // Check if lock from current user
        if (req.user.id === lock.creator) {
          // Send current lock info
          return {
            json: lock,
          };
        } else {
          // Send error
          throw new RequestException(401, {
            error: {
              message: req.i18n(
                'This document is already locked by another user.',
              ),
              type: req.i18n('Already locked'),
            },
          });
        }
      } else {
        const newLock = {
          created: dayjs.utc().format(),
          creator: req.user.id,
          creator_name: req.user.fullname,
          creator_url: `${getRootUrl(req)}/@users/${req.user.id}`,
          locked: true,
          stealable:
            typeof req.body?.stealable === 'undefined'
              ? true
              : req.body.stealable,
          time: dayjs.utc().format(),
          timeout: req.body?.timeout || 600,
          token: uuid(),
        };
        // Create new lock
        await req.document.update(
          {
            lock: newLock,
          },
          trx,
        );
        return {
          json: newLock,
        };
      }
    },
  },
  {
    op: 'patch',
    view: '/@lock',
    permission: 'Modify',
    client: 'updateLock',
    cache: 'alter',
    handler: async (req: Request, trx: Knex.Transaction) => {
      const lock = req.document.lock;

      // Nothing to refresh if not locked
      if (!lock.locked || lockExpired(req.document)) {
        return {
          json: {
            locked: false,
            stealable: true,
          },
        };
      }

      // Check if lock from another user
      if (req.user.id !== lock.creator) {
        // Send error
        throw new RequestException(401, {
          error: {
            message: req.i18n(
              'This document is already locked by another user.',
            ),
            type: req.i18n('Already locked'),
          },
        });
      }

      // Refresh the lock and keep token, timeout and stealable
      const refreshedLock = {
        ...lock,
        created: dayjs.utc().format(),
        time: dayjs.utc().format(),
      };
      await req.document.update(
        {
          lock: refreshedLock,
        },
        trx,
      );
      return {
        json: refreshedLock,
      };
    },
  },
  {
    op: 'delete',
    view: '/@lock',
    permission: 'Modify',
    client: 'deleteLock',
    cache: 'alter',
    handler: async (req: Request, trx: Knex.Transaction) => {
      const lock = req.document.lock;

      // Unlock if locked by the current user or a stealable lock is forced
      if (lock.locked && !lockExpired(req.document)) {
        const owner = lock.creator === req.user.id;
        if (!owner && !(req.body?.force && lock.stealable !== false)) {
          // Send error
          throw new RequestException(401, {
            error: {
              message: req.i18n(
                'You don’t have permission to unlock this document.',
              ),
              type: req.i18n('Not allowed'),
            },
          });
        }
      }

      // Remove lock
      const unlocked = {
        locked: false,
        stealable: true,
      };
      if (lock.locked) {
        await req.document.update(
          {
            lock: unlocked,
          },
          trx,
        );
      }
      return {
        json: unlocked,
      };
    },
  },
];
