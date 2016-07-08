import _ from 'underscore';

const metricsProperties = [
  'elTop',
  'elHeight',
  'visibleTop',
  'visibleHeight',
  'listTop',
  'listHeight',
  'itemsTop',
  'itemsHeight',
  'scrollTop',
];

/**
 * Class representing the geometry metrics of the list view
 */
export class Metrics {

  /**
   * Create a Metrics object
   *
   * @param {Object} options               geometry metrics
   * @param {number} options.elTop         top of the scrollable content
   * @param {number} options.elHeight      height of the scrollable content
   * @param {number} options.visibleTop    top of the visible area
   * @param {number} options.visibleHeight height of the visible area
   * @param {number} options.listTop       top of the .list-container element
   * @param {number} options.listHeight    height of the .list-container element
   * @param {number} options.itemsTop      top of the rendered items
   * @param {number} options.itemsHeight   height of the rendered items
   * @param {number} options.scrollTop     the scrolled height
   *
   * @description The metrics properties are
   * ```
   *         elHeight                    scrollTop
   * +------+ <--=---------------------------=----------------------- elTop
   * |      |    |                           |
   * |      |    | listHeight                | [paddingTop]
   * +------+ <--+-----=---------------------+-----=--------------- listTop
   * |      |    |     |                     |     |
   * |      |    |     | itemsHeight         |     |
   * +------+ <--+-----+-----=---------------+-----V-------------- itemsTop
   * |XXXXXX|    |     |     |               |
   * |XXXXXX|    |     |     | visibleHeight |
   * +------+ <--+-----+-----+-------=-------V------------------ visibleTop
   * |XXXXXX|    |     |     |       |
   * |XXXXXX|    |     |     |       |
   * |XXXXXX|    |     |     |       |
   * +------+ <--+-----+-----+-------V------------------------ [visibleBot]
   * |XXXXXX|    |     |     |
   * |XXXXXX|    |     |     |                 [paddingBot]
   * +------+ <--+-----+-----V---------------------=------------ [itemsBot]
   * |      |    |     |                           |
   * |      |    |     |                           |
   * +------+ <--+-----V---------------------------V------------- [listBot]
   * |      |    |
   * |      |    |
   * +------+ <--V------------------------------------------------- [elBot]
   * ```
   *
   * NOTE:
   *
   *   1. Metrics with name in brackets are *READ-ONLY* computed values.
   *   2. All xxTop, xxBot properties are relative to frame
   *
   */
  constructor({
    elTop,
    elHeight,
    visibleTop,
    visibleHeight,
    listTop,
    listHeight,
    itemsTop,
    itemsHeight,
    scrollTop,
  } = {}) {
    /**
     * top of the scrollable content
     * @type {number}
     */
    this.elTop = elTop;

    /**
     * height of the scrollable content
     * @type {number}
     */
    this.elHeight = elHeight;

    /**
     * top of the visible area
     * @type {number}
     */
    this.visibleTop = visibleTop;

    /**
     * height of the visible area
     * @type {number}
     */
    this.visibleHeight = visibleHeight;

    /**
     * top of the .list-container element
     * @type {number}
     */
    this.listTop = listTop;

    /**
     * height of the .list-container element
     * @type {number}
     */
    this.listHeight = listHeight;

    /**
     * top of the rendered items
     * @type {number}
     */
    this.itemsTop = itemsTop;

    /**
     * height of the rendered items
     * @type {number}
     */
    this.itemsHeight = itemsHeight;

    /**
     * the scrolled height
     * @type {number}
     */
    this.scrollTop = scrollTop;
  }

  /**
   * Set the geometry properties
   * @param {Object} options the same `options` as that of the constructor
   * @see Metrics
   */
  set(options) {
    _.extend(this, _.pick(options, metricsProperties));
  }

  /**
   * bottom of the scrollable content
   * @type {number}
   */
  get elBot() {
    return this.elTop + this.elHeight;
  }

  /**
   * bottom of the visible area
   * @type {number}
   */
  get visibleBot() {
    return this.visibleTop + this.visibleHeight;
  }

  /**
   * bottom of the .list-container element
   * @type {number}
   */
  get listBot() {
    return this.listTop + this.listHeight;
  }

  /**
   * bottom of the rendered items
   * @type {number}
   */
  get itemsBot() {
    return this.itemsTop + this.itemsHeight;
  }

  /**
   * padding-top of the .list-container element
   * @type {number}
   */
  get paddingTop() {
    return this.itemsTop - this.listTop;
  }

  /**
   * padding-top of the .list-container element
   * @type {number}
   */
  get paddingBot() {
    return this.listBot - this.itemsBot;
  }
}

