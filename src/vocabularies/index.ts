/**
 * Vocabularies.
 * @module vocabularies
 */

// Type imports
import type { VocabularyHandler } from '../types';

/**
 * A vocabulary registry.
 * @class Vocabularies
 */
class Vocabularies {
  public vocabularies: { [key: string]: VocabularyHandler };
  public permissions: { [key: string]: string };
  static instance: Vocabularies;

  /**
   * Construct a Vocabularies.
   * @constructs Vocabularies
   */
  constructor() {
    this.vocabularies = {};
    this.permissions = {};

    if (!Vocabularies.instance) {
      Vocabularies.instance = this;
    }

    return Vocabularies.instance;
  }

  /**
   * Register a vocabulary.
   * @param {string} name The name of the vocabulary.
   * @param {VocabularyHandler} vocabulary The vocabulary to register.
   * @param {string} permission Permission needed besides View (optional).
   */
  register(name: string, vocabulary: VocabularyHandler, permission?: string) {
    this.vocabularies[name] = vocabulary;
    if (permission) {
      this.permissions[name] = permission;
    }
  }

  /**
   * Get the permission needed besides View to get a vocabulary.
   * @param {string} name The name of the vocabulary.
   * @returns {string | undefined} The permission.
   */
  permission(name: string): string | undefined {
    return this.permissions[name];
  }

  /**
   * Get a vocabulary.
   * @param {string} name The name of the vocabulary.
   * @returns {VocabularyHandler} The vocabulary.
   */
  get(name: string): VocabularyHandler {
    if (!this.vocabularies[name]) {
      return this.vocabularies['_default'];
    }
    return this.vocabularies[name];
  }

  /**
   * Check if a vocabulary exists.
   * @param {string} name The name of the vocabulary.
   * @returns {boolean} True if the vocabulary exists, false otherwise.
   */
  exists(name: string): boolean {
    return Object.keys(this.vocabularies).includes(name);
  }
}

// Create an instance of the Vocabularies registry
const vocabularies = new Vocabularies();

// Export the instance and all vocabularies
export default vocabularies;
