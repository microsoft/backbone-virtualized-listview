import _ from 'underscore';
import $ from 'jquery';
import Backbone from 'backbone';
import BinaryIndexedTree from 'fast-binary-indexed-tree';

import defaultListTemplate from './default-list.jade';
import defaultItemTemplate from './default-item.jade';
import { ElementViewport, WindowViewport } from './viewport.js';

// Helper function to created a scoped while loop
const whileTrue = func => {
  while (func());
};

const INVALIDATION_NONE = 0;
const INVALIDATION_ITEMS = 0x1;
const INVALIDATION_METRICS = 0x2;
const INVALIDATION_EVENTS = 0x4;
const INVALIDATION_LIST = 0x8;
const INVALIDATION_ALL = 0xf;

/**
 * The virtualized list view class.
 *
 * In addition to ordinary Backbone View options, the constructor also takes
 *
 * __model__: the model object to render the skeleton of the list view.
 *
 *  * Can be reset by {@link ListView#reset}
 *
 * __listTemplate__: the template to render the skeleton of the list view.
 *
 *  * By default, it would render a single `UL`.
 *  * Can be reset by {@link ListView#reset}
 *  * __Note__: It must contain an empty element with class name
 *    `'list-container'`, as the parrent of all list items.
 *
 * __items__: the model objects of the list items.
 *
 *  * Can be reset by {@link ListView#reset}
 *
 * __itemTemplate__: the template to render a list item.
 *
 *  * By default, it would render a single `LI` filled with `item.text`.
 *  * Can be reset by {@link ListView#reset}
 *  * __Note__: list items __MUST NOT__ have outer margins, otherwise the layout
 *    calculation will be inaccurate.
 *
 * __defaultItemHeight__: the estimated height of a single item.
 *
 *  * It's not necessary to be accurate. But the accurater it is, the less the
 *    scroll bar is adjusted overtime.
 *  * Can be reset by {@link ListView#reset}
 *
 * __viewport__: the CSS selector to locate the scrollable viewport.
 *
 *  * If it's omitted, the `window` will be used as the viewport.
 *  * Cannot be reset by ListView#reset.
 *
 * @param {Object} options The constructor options.
 * @param {Object} options.model
 * @param {ListView~cbListTemplate} [options.listTemplate]
 * @param {Object[]} [options.items=[]]
 * @param {ListView~cbItemTemplate} [options.itemTemplate]
 * @param {number} [options.defaultItemHeight=20]
 * @param {string} [options.viewport]
 *
 */

class ListView extends Backbone.View {

  /**
   * Backbone view initializer
   * @see ListView
   *
   */
  initialize({
    model = {},
    listTemplate = defaultListTemplate,
    events = {},

    items = [],
    itemTemplate = defaultItemTemplate,
    defaultItemHeight = 20,

    virtualized = true,
    viewport = null,
  } = {}) {
    this.options = {
      model,
      listTemplate,
      events,

      items,
      itemTemplate,
      defaultItemHeight,
    };

    this.virtualized = virtualized;

    // States
    this.indexFirst = 0;
    this.indexLast = 0;
    this.anchor = null;
    this.invalidation = INVALIDATION_NONE;
    this.removed = false;

    this._scheduleRedraw = (() => {
      let requestId = null;

      return () => {
        if (this.viewport && !requestId) {
          requestId = window.requestAnimationFrame(() => {
            requestId = null;
            if (!this.removed) {
              this._redraw();
            }
          });
        }
      };
    })();

    this._hookUpViewport = () => {
      this.viewport = viewport ? new ElementViewport(viewport) : new WindowViewport();

      if (this.virtualized) {
        let blockUntil = 0;

        const onViewportChange = () => {
          if (performance.now() > blockUntil) {
            this._scheduleRedraw();
          } else if (!this.removed) {
            // If the scroll events are blocked, we shouldn't just swallow them.
            // Wait for 0.1 second and give another try.
            window.setTimeout(onViewportChange, 100);
          }
        };

        this.viewport.on('change', onViewportChange);

        //
        // On keypress, we want to block the scroll events for 0.2 second to wait
        // for the animation to complete. Otherwise, the scroll would change the
        // geometry metrics and break the animation. The worst thing we may get is,
        // for 'HOME' and 'END' keys, the view doesn't scroll to the right position.
        //
        this.viewport.on('keypress', () => {
          blockUntil = performance.now() + 200;
        });
      }
    };
  }

  /**
   * Remove the view and unregister the event listeners.
   */
  remove() {
    this.removed = true;
    if (this.viewport) {
      this.viewport.remove();
    }
    super.remove();
  }

  _applyPaddings({ paddingTop, paddingBottom }) {
    if (this.$topFiller && this.$bottomFiller) {
      this.$topFiller.height(paddingTop);
      this.$bottomFiller.height(paddingBottom);
    }
  }

  _processInvalidation() {
    const { items, events, listTemplate, model } = this.options;

    if (this.invalidation & INVALIDATION_EVENTS) {
      this.undelegateEvents();
    }
    if (this.invalidation & INVALIDATION_METRICS) {
      this._itemHeights = null;
    }
    if (this.invalidation & INVALIDATION_LIST) {
      this.$el.html(listTemplate(model));
      this.$container = this.$('.list-container');
      this.$container.css({
        marginTop: 0,
        marginBottom: 0,
        paddingTop: 0,
        paddingBottom: 0,
      });
      this.$topFiller = this.$('.top-filler');
      this.$bottomFiller = this.$('.bottom-filler');
      this._applyPaddings({
        paddingTop: 0,
        paddingBottom: this.itemHeights.read(items.length),
      });
      this.indexFirst = this.indexLast = 0;
    }
    if (this.invalidation & INVALIDATION_EVENTS) {
      this.delegateEvents(events);
    }
    const invalidateItems = this.invalidation & INVALIDATION_ITEMS;

    this.invalidation = INVALIDATION_NONE;
    return invalidateItems;
  }

  // Private API, redraw immediately
  _redraw() {
    let invalidateItems = this._processInvalidation();
    const { items, itemTemplate } = this.options;
    const { viewport, itemHeights, $container, virtualized } = this;
    let { indexFirst, indexLast, anchor } = this;

    /**
     * The event indicates the list will start redraw.
     * @event ListView#willRedraw
     */
    this.trigger('willRedraw');

    whileTrue(() => {
      let isCompleted = true;

      const metricsViewport = viewport.getMetrics();
      const visibleTop = metricsViewport.outer.top;
      const visibleBot = metricsViewport.outer.bottom;
      const listTopCur = this.$topFiller.get(0).getBoundingClientRect().top;
      const scrollRatio = metricsViewport.scroll.ratioY;

      let renderTop = false;
      let renderBot = false;

      whileTrue(() => {
        const listTop = anchor ? anchor.top - itemHeights.read(anchor.index) : listTopCur;
        const targetFirst = itemHeights.lowerBound(visibleTop - listTop);
        const targetLast = Math.min(itemHeights.upperBound(visibleBot - listTop) + 1, items.length);
        const renderFirst = virtualized ? Math.max(targetFirst - 10, 0) : 0;
        const renderLast = virtualized ? Math.min(targetLast + 10, items.length) : items.length;

        let renderMore = false;

        // Clean up
        if (targetFirst >= indexLast || targetLast <= indexFirst || invalidateItems) {
          $container.empty();
          indexFirst = indexLast = targetFirst;
          if (targetFirst !== targetLast && items.length > 0) {
            renderMore = true;
          }
          if (!anchor) {
            const index = Math.round(targetFirst * (1 - scrollRatio) + targetLast * scrollRatio);
            const top = listTopCur + itemHeights.read(index);
            anchor = { index, top };
          }
          invalidateItems = false;
        } else if (!anchor) {
          const index = Math.round(indexFirst * (1 - scrollRatio) + indexLast * scrollRatio);
          const top = listTopCur + itemHeights.read(index);
          anchor = { index, top };
        }

        // Render top
        if (targetFirst < indexFirst) {
          $container.prepend(items.slice(renderFirst, indexFirst).map(itemTemplate));
          $container.children().slice(0, indexFirst - renderFirst).each((offset, el) => {
            itemHeights.writeSingle(renderFirst + offset, el.getBoundingClientRect().height);
          });
          indexFirst = renderFirst;
          renderMore = renderTop = true;
        } else if (renderBot && !renderTop && renderFirst > indexFirst) {
          const removal = [];
          $container.children().slice(0, renderFirst - indexFirst).each((offset, el) => removal.push(el));
          $(removal).remove();
          indexFirst = renderFirst;
          renderMore = true;
        }

        // Render bottom
        if (targetLast > indexLast) {
          $container.append(items.slice(indexLast, renderLast).map(itemTemplate));
          $container.children().slice(indexLast - indexFirst).each((offset, el) => {
            itemHeights.writeSingle(indexLast + offset, el.getBoundingClientRect().height);
          });
          indexLast = renderLast;
          renderMore = renderBot = true;
        } else if (renderTop && !renderBot && renderLast < indexLast) {
          const removal = [];
          $container.children().slice(renderLast - indexFirst).each((offset, el) => removal.push(el));
          $(removal).remove();
          indexLast = renderLast;
          renderMore = true;
        }

        return renderMore;
      });

      // Update the padding
      if (indexFirst !== this.indexFirst || indexLast !== this.indexLast) {
        this._applyPaddings({
          paddingTop: itemHeights.read(indexFirst),
          paddingBottom: itemHeights.read(items.length) - itemHeights.read(indexLast),
        });
      }

      // Adjust the scroll if it's changed significantly
      const listTop = anchor.top - itemHeights.read(anchor.index);
      const innerTop = listTop - (listTopCur - metricsViewport.inner.top);
      const scrollTop = Math.round(visibleTop - innerTop);
      let anchorNew = null;

      // Do a second scroll for a middle anchor after the item is rendered
      if (anchor.isMiddle) {
        const index = anchor.index;
        const itemTop = listTopCur + this.itemHeights.read(index);
        const itemBot = listTopCur + this.itemHeights.read(index + 1);

        anchorNew = {
          index,
          top: (visibleTop + visibleBot + itemTop - itemBot) / 2,
        };
        isCompleted = false;
      }

      if (Math.abs(scrollTop - viewport.getMetrics().scroll.y) >= 1) {
        this.viewport.scrollTo({ y: scrollTop });
        isCompleted = false;
      }

      anchor = anchorNew;

      return !isCompleted;
    });

    // Write back the render state
    this.indexFirst = indexFirst;
    this.indexLast = indexLast;
    this.anchor = null;

    /**
     * The event indicates the list view have completed redraw.
     * @event ListView#didRedraw
     */
    this.trigger('didRedraw');
  }

  /**
   * Get the item at certain index.
   * @param {number} index The index of the item.
   * @return {Object}
   */
  itemAt(index) {
    return _.first(this.options.items.slice(index, index + 1));
  }

  /**
   * The total count of the items.
   * @type {number}
   */
  get length() {
    return this.options.items.length;
  }

  /**
   * The template to render the skeleton of the list view.
   * @callback ListView~cbListTemplate
   * @param {Object} model The model object of the list view.
   */

  /**
   * The template to render the skeleton of the list view.
   * @type {ListView~cbListTemplate}
   */
  get listTemplate() {
    return this.options.listTemplate;
  }

  /**
   * The template to render a list item.
   * @callback ListView~cbItemTemplate
   * @param {Object} item The model object of the item
   */

  /**
   * The template to render a list item.
   * @type {ListView~cbItemTemplate}
   */
  get itemTemplate() {
    return this.options.itemTemplate;
  }

  /**
   * The default list item height.
   * @type {number}
   */
  get defaultItemHeight() {
    return this.options.defaultItemHeight;
  }

  /**
   * @external BinaryIndexedTree
   * @see {@link https://microsoft.github.io/fast-binary-indexed-tree-js/BinaryIndexedTree.html}
   */

  /**
   * The BinaryIndexedTree to get the heights and accumulated heights of items.
   * @type {external:BinaryIndexedTree}
   */
  get itemHeights() {
    if (!this._itemHeights) {
      const { defaultItemHeight, items } = this.options;
      this._itemHeights = new BinaryIndexedTree({
        defaultFrequency: Math.max(defaultItemHeight, 1),
        maxVal: items.length,
      });
    }
    return this._itemHeights;
  }

  /**
   * Reset the list view options. The following options can be reset
   *
   *  * model
   *  * listTemplate
   *  * items
   *  * itemTemplate
   *  * defaultItemHeight
   *  * events
   *
   * Refer to {@link ListView} for detail.
   *
   * @param {Object} options The new options.
   * @param {function} [callback] The callback to notify completion.
   */
  reset(options = {}, callback = _.noop) {
    const isSet = key => _.has(options, key);

    _.extend(this.options, options);

    if (_.some(['model', 'listTemplate'], isSet)) {
      this._invalidate(INVALIDATION_ALL);
    } else {
      if (_.some(['items', 'itemTemplate', 'defaultItemHeight'], isSet)) {
        this._itemHeights = null;
        this._invalidate(INVALIDATION_ITEMS);
      }
      if (isSet('events')) {
        this._invalidate(INVALIDATION_EVENTS);
      }
    }

    if (this.invalidation) {
      this.once('didRedraw', callback);
    } else if (_.isFunction(callback)) {
      callback();
    }
  }

  _invalidate(invalidation) {
    this.invalidation |= invalidation;
    this._scheduleRedraw();
  }

  /**
   * Invalidate the already rendered items and schedule another redraw.
   * @param {function} [callback] The callback to notify completion.
   */
  invalidate(callback = _.noop) {
    this._invalidate(INVALIDATION_ITEMS);
    this.once('didRedraw', callback);
  }

  /**
   * Scroll to a certain item.
   * @param {number} index The index of the item.
   * @param {string|number} [position='default'] The position of the item.
   * @param {function} [callback] The callback to notify completion.
   *
   * The valid positions are
   *   * `'default'`, if the item is above the viewport top, scroll it to the
   *     top, if the item is below the viewport bottom, scroll it to the bottom,
   *     otherwise, keep the viewport unchanged.
   *   * `'top'`, scroll the item to top of the viewport.
   *   * `'middle'`, scroll the item to the vertical center of the viewport.
   *   * `'bottom'`, scroll the item to the bottom of the viewport.
   *   * `{number}`, scroll the item to the given offset from the viewport top.
   */
  scrollToItem(...args) {
    if (!this.$container) {
      throw new Error('Cannot scroll before the view is rendered');
    }
    let index = 0;
    let position = 'default';
    let callback = _.noop;

    if (args.length >= 3) {
      [index, position, callback] = args;
    } else if (args.length === 2) {
      if (_.isFunction(args[1])) {
        [index, callback] = args;
      } else {
        [index, position] = args;
      }
    } else if (args.length === 1) {
      index = args[0];
    }
    this._scrollToItem(index, position, callback);
  }

  _scrollToItem(index, position, callback) {
    const metricsViewport = this.viewport.getMetrics();
    const visibleTop = metricsViewport.outer.top;
    const visibleBot = metricsViewport.outer.bottom;
    const listTopCur = this.$topFiller.get(0).getBoundingClientRect().top;
    const itemTop = listTopCur + this.itemHeights.read(index);
    const itemBot = listTopCur + this.itemHeights.read(index + 1);
    let pos = position;

    if (pos === 'default') {
      if (itemTop < visibleTop) {
        pos = 'top';
      } else if (itemBot > visibleBot) {
        pos = 'bottom';
      } else {
        if (_.isFunction(callback)) {
          callback();
        }
        return;
      }
    }

    if (pos === 'top') {
      this.anchor = {
        index,
        top: visibleTop,
      };
    } else if (pos === 'bottom') {
      this.anchor = {
        index: index + 1,
        top: visibleBot,
      };
    } else if (pos === 'middle') {
      this.anchor = {
        index: index,
        top: (visibleTop + visibleBot + itemTop - itemBot) / 2,
        isMiddle: true,
      };
    } else if (typeof pos === 'number') {
      this.anchor = {
        index: index,
        top: visibleTop + pos,
      };
    } else {
      throw new Error('Invalid position');
    }

    this.once('didRedraw', callback);

    this._scheduleRedraw();
  }

  /**
   * Render the list view.
   * @param {function} [callback] The callback to notify completion.
   */
  render(callback = _.noop) {
    this._hookUpViewport();
    this._invalidate(INVALIDATION_ALL);
    this.once('didRedraw', callback);
    return this;
  }

}

export default ListView;
