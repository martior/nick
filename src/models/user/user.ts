/**
 * User Model.
 * @module models/user/user
 */

// Type imports
import type { Knex } from 'knex';
import type { Json, Request, VocabularyTerm } from '../../types';

// External imports
import { compact, flattenDeep, uniq } from 'es-toolkit/array';

// Internal imports
import models from '../';
import { Model } from '../_model/_model';
import { authenticatedUsers } from '../../helpers/auth/auth';
import config from '../../helpers/config/config';
import { removeFile } from '../../helpers/fs/fs';
import { getFactoryFields } from '../../helpers/schema/schema';
import { getRootUrl } from '../../helpers/url/url';
import { mapAsync } from '../../helpers/utils/utils';

/**
 * A model for User.
 * @class User
 * @extends Model
 */
export class User extends Model {
  static tableName: string = 'user';

  // Declare properties
  declare id: string;
  declare fullname: string;
  declare email: string;
  declare tokens: string[];
  declare json: any;
  declare _roles: any[];
  declare _groups: any[];

  // Set relation mappings
  static get relationMappings(): any {
    const Role = models.get('Role');
    const Group = models.get('Group');
    return {
      _roles: {
        relation: Model.ManyToManyRelation,
        modelClass: Role,
        join: {
          from: 'user.id',
          through: {
            from: 'user_role.user',
            to: 'user_role.role',
          },
          to: 'role.id',
        },
      },
      _groups: {
        relation: Model.ManyToManyRelation,
        modelClass: Group,
        join: {
          from: 'user.id',
          through: {
            from: 'user_group.user',
            to: 'user_group.group',
          },
          to: 'group.id',
        },
      },
      _documentRoles: {
        relation: Model.ManyToManyRelation,
        modelClass: Role,
        join: {
          from: 'user.id',
          through: {
            from: 'user_role_document.user',
            to: 'user_role_document.role',
            extra: ['document'],
          },
          to: 'role.id',
        },
      },
    };
  }

  /**
   * Returns JSON data.
   * @method toJson
   * @param {Request} req Request object.
   * @returns {Json} JSON object.
   */
  toJson(req: Request): Json {
    const self: InstanceType<typeof User> = this;
    return {
      '@id': `${getRootUrl(req)}/@users/${self.id}`,
      id: self.id,
      username: self.id,
      fullname: self.fullname,
      email: self.email,
      roles: self._roles ? self._roles.map((role: any) => role.id) : [],
      groups: self._groups ? self._groups.map((group: any) => group.id) : [],
      ...self.json,
    } as Json;
  }

  /**
   * Get groups of the user. Authenticated users are member of the
   * `AuthenticatedUsers` group, like in Plone.
   * @method getGroups
   * @returns {string[]} Array of groups.
   */
  getGroups(): string[] {
    const self: InstanceType<typeof User> = this;
    const groups = self._groups
      ? self._groups.map((group: any) => group.id)
      : [];
    return self.id === 'anonymous' || groups.includes(authenticatedUsers)
      ? groups
      : [...groups, authenticatedUsers];
  }

  /**
   * Get roles of the user.
   * @method getRoles
   * @returns {string[]} Array of roles.
   */
  getRoles(): string[] {
    const self: InstanceType<typeof User> = this;
    // Add anonymous or authenticated role based on user
    let roles: string[] =
      self.id === 'anonymous' ? ['Anonymous'] : ['Authenticated'];

    // Add roles of the user
    if (self._roles) {
      roles = [...roles, ...self._roles.map((role: any) => role.id)];
    }

    // Add roles of the groups of the users
    if (self._groups) {
      self._groups.map((group: any) => {
        if (group._roles) {
          roles = [...roles, ...group._roles.map((role: any) => role.id)];
        }
      });
    }

    // Return roles
    return roles;
  }

  /**
   * Lock the user and reload its tokens, so concurrent logins and logouts
   * don't overwrite each other's tokens.
   * @method lockTokens
   * @param {Knex.Transaction} trx Transaction object.
   * @returns {Promise<void>}
   */
  async lockTokens(trx: Knex.Transaction): Promise<void> {
    const self: InstanceType<typeof User> = this;
    const row: any = await User.query(trx)
      .select('tokens')
      .findById(self.id)
      .forUpdate();
    self.tokens = row?.tokens || [];
  }

  /**
   * Fetch user roles by document.
   * @method fetchRolesByDocument
   * @param {string} document Uuid of the document
   * @param {Knex.Transaction} trx Transaction object.
   * @returns {Promise<string[]>} Array of roles.
   */
  async fetchRolesByDocument(
    document: string,
    trx?: Knex.Transaction,
  ): Promise<string[]> {
    const self: InstanceType<typeof User> = this;
    const rows: any[] = await self.$relatedQuery('_documentRoles', trx).where({
      'user_role_document.document': document,
    });
    return rows.map((role: any) => role.id);
  }

  /**
   * Fetch user and group roles by document.
   * @method fetchUserGroupRolesByDocument
   * @param {string} document Uuid of the document
   * @param {Knex.Transaction} trx Transaction object.
   * @returns {Promise<string[]>} Array of roles.
   */
  async fetchUserGroupRolesByDocument(
    document: string,
    trx?: Knex.Transaction,
  ): Promise<string[]> {
    const Group = models.get('Group');
    const roles = await this.fetchRolesByDocument(document, trx);
    const groupRoles = await Group.fetchRolesByDocument(
      this.getGroups(),
      document,
      trx,
    );
    return uniq([...roles, ...groupRoles]);
  }

  /**
   * Delete files and images associated with the user
   * @method deleteFilesAndImages
   * @param {Request} req Request object.
   * @param {Knex.Transaction} trx Knex transaction
   * @return {Promise<void>} Return void
   */
  async deleteFilesAndImages(
    req: Request,
    trx: Knex.Transaction,
  ): Promise<void> {
    const self: InstanceType<typeof User> = this;

    // Get file and image fields
    const fileFields = getFactoryFields(
      config.settings.userschema(req),
      'File',
    );
    const imageFields = getFactoryFields(
      config.settings.userschema(req),
      'Image',
    );

    // If file fields exist
    if (fileFields.length > 0 || imageFields.length > 0) {
      // Get all file uuids from all fields
      const files = compact(
        uniq(
          flattenDeep([
            ...fileFields.map((field: string) => self.json[field]?.uuid),
            ...imageFields.map((field: string) => [
              self.json[field]?.uuid,
              ...Object.keys(config.settings.imageScales).map(
                (scale) => self.json[field]?.scales?.[scale].uuid,
              ),
            ]),
          ]),
        ),
      );

      // Remove files
      await mapAsync(files, async (file: any) => await removeFile(file, trx));
    }
  }

  /**
   * Returns vocabulary data.
   * @method getVocabularyTerm
   * @param {Request} req Request object.
   * @returns {VocabularyTerm} Vocabulary term.
   */
  getVocabularyTerm(req: Request): VocabularyTerm {
    const self: InstanceType<typeof User> = this;
    return {
      title: req.i18n(self.fullname),
      token: self.id,
    };
  }
}
