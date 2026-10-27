/**
 * Rating behavior: the code half of the `example_rating` behavior; the
 * schema half is `profiles/default/behaviors/example_rating.json`.
 * @module behaviors/rating/rating
 */

interface Document {
  json: {
    rating?: number;
  };
}

/**
 * Rating behavior.
 * @constant rating
 */
export const rating = {
  /**
   * Get the rating as stars
   * @method getStars
   * @returns {string} Stars, like ★★★☆☆.
   */
  getStars: function (this: Document): string {
    const value = Math.max(0, Math.min(5, Math.round(this.json.rating || 0)));
    return `${'★'.repeat(value)}${'☆'.repeat(5 - value)}`;
  },
};
