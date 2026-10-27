/**
 * Querystring helper tests.
 * @module helpers/querystring/querystring.test
 */

// External imports
import { describe, it, expect } from 'vitest';

// Internal imports
import { expandable, parseQuerystring } from './querystring';

describe('parseQuerystring', () => {
  it('should leave plain parameters as the simple parser gives them', () =>
    expect(parseQuerystring('b_size=25&sort_on=modified')).toEqual({
      b_size: '25',
      sort_on: 'modified',
    }));

  it('should fold repeated :list parameters into a list under the bare name', () =>
    expect(
      parseQuerystring('expand:list=breadcrumbs&expand:list=navigation'),
    ).toEqual({ expand: ['breadcrumbs', 'navigation'] }));

  it('should make a single :list parameter a list of one', () =>
    expect(parseQuerystring('metadata_fields:list=_all')).toEqual({
      metadata_fields: ['_all'],
    }));

  it('should merge a bare parameter with its :list form, bare values first', () =>
    expect(parseQuerystring('expand=actions&expand:list=navigation')).toEqual({
      expand: ['actions', 'navigation'],
    }));

  it('should accept an encoded colon in the parameter name', () =>
    expect(
      parseQuerystring('expand%3Alist=actions&expand%3Alist=types'),
    ).toEqual({ expand: ['actions', 'types'] }));

  it('should handle an empty querystring', () =>
    expect(parseQuerystring('')).toEqual({}));
});

describe('expandable', () => {
  it('should return no elements when expand is absent', () =>
    expect(expandable(undefined)).toEqual([]));

  it('should split a comma separated string', () =>
    expect(expandable('breadcrumbs,navigation')).toEqual([
      'breadcrumbs',
      'navigation',
    ]));

  it('should wrap a single value in a list', () =>
    expect(expandable('navigation')).toEqual(['navigation']));

  it('should keep a list as it is', () =>
    expect(expandable(['breadcrumbs', 'navigation'])).toEqual([
      'breadcrumbs',
      'navigation',
    ]));
});
