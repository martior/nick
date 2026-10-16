/**
 * Error helper.
 * @module helpers/error/error
 */

export type Status = 301 | 302 | 400 | 401 | 403 | 404 | 423 | 500;
export type Message =
  | string
  | {
      message: string;
    }
  | {
      type: string;
      message: string;
    }
  | {
      error: string;
    }
  | {
      error: {
        type: string;
        message: string;
      };
    };

/**
 * Request exception class.
 * @class RequestException
 */
export class RequestException {
  status: Status;
  message: Message;

  /**
   * Construct a RequestException.
   * @constructs RequestException
   * @param {Status} status The HTTP status code.
   * @param {Message} message The error message.
   */
  constructor(status: Status, message: Message) {
    this.status = status;
    this.message = message;
  }
}

/**
 * Check if an error is a database deadlock or serialization failure, which
 * can be solved by running the transaction again.
 * @method isRetryableError
 * @param {any} err The error.
 * @returns {boolean} True if the transaction can be retried.
 */
export function isRetryableError(err: any): boolean {
  const code = err?.code || err?.nativeError?.code;
  return code === '40P01' || code === '40001';
}

/**
 * Check if an error is a violation of the unique ids of the documents in a
 * folder, see the document_unique_id migration.
 * @method isDuplicateIdError
 * @param {any} err The error.
 * @returns {boolean} True if an id is already used in the folder.
 */
export function isDuplicateIdError(err: any): boolean {
  const error = err?.nativeError || err;
  return (
    error?.code === '23505' && error?.constraint === 'document_parent_id_unique'
  );
}

/**
 * Error types of the plone.restapi error bodies by status code.
 * @constant errorTypes
 */
export const errorTypes: { [status: string]: string } = {
  '400': 'BadRequest',
  '401': 'Unauthorized',
  '403': 'Forbidden',
  '404': 'NotFound',
  '500': 'InternalServerError',
};

/**
 * Get the body of an error response. Error messages are returned like in
 * plone.restapi, as `{ type, message }`; a missing type is derived from the
 * status code and `{ error: <string> }` becomes the message.
 * @method errorBody
 * @param {number} status The HTTP status code.
 * @param {Message} message The error message.
 * @returns {Message} The error body.
 */
export function errorBody(status: number, message: Message): Message {
  if (
    message &&
    typeof message === 'object' &&
    'error' in message &&
    typeof message.error === 'string'
  ) {
    return errorBody(status, { message: message.error });
  }
  if (
    message &&
    typeof message === 'object' &&
    'message' in message &&
    !('type' in message) &&
    errorTypes[status]
  ) {
    return { type: errorTypes[status], ...message };
  }
  return message;
}
