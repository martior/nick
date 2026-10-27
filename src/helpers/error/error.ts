/**
 * Error helper.
 * @module helpers/error/error
 */

export type Status = 301 | 302 | 400 | 401 | 403 | 404 | 413 | 423 | 500;
export type Message =
  | string
  | {
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
