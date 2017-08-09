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
const INVALIDATION_EVENTS = 0x2;
const INVALIDATION_LIST = 0x4;
const INVALIDATION_ALL = 0x7;

const LIST_VIEW_EVENTS = ['willRedraw', 'didRedraw'];

/**
 * The virtualized list view class.
 *
 * In addition to ordinary Backbone View options, the constructor also takes
 *
 * __virtualized__: whether or not the virtualization is enabled.
 *
 * __viewport__: the option locate the scrollable viewport. It can be
 *
 *  * Omitted, auto detect the closest ancestor of the `$el` with 'overflowY'
 *    style being 'auto' or 'scroll'. Use the window viewport if found none.
 *  * A `string`, use it as a selector to select an __internal__ element as
 *    the viewport.
 *  * An `HTMLElement` or `jQuery`, use it as the viewport element.
 *  * The `window`, use the window viewport.
 *
 * @param {Object} options The constructor options.
 * @param {boolean} [options.virtualized=true]
 * @param {string | HTMLElement | jQuery | window} [options.viewport]
 *
 */

class ListView extends Backbone.View {

  /**
   * Backbone view initializer
   * @see ListView
   */
  initialize({
    virtualized = true,
    viewport = null,
  } = {}) {
    this._props = { virtualized, viewport };
    this.options = {
      model: {},
      listTemplate: defaultListTemplate,
      events: {},
      items: [],
      itemTemplate: defaultItemTemplate,
      defaultItemHeight: 20,
    };

    // States
    this._state = {
      indexFirst: 0,
      indexLast: 0,
      anchor: null,
      invalidation: INVALIDATION_NONE,
      removed: false,
      eventsListView: {},
    };

    this._scheduleRedraw = _.noop;
  }

  _initViewport() {
    const viewport = this._props.viewport;

    if (_.isString(viewport)) {
      return new ElementViewport(this.$(viewport));
    } else if (viewport instanceof $) {
      if (viewport.get(0) === window) {
        return new WindowViewport();
      }
      return new ElementViewport(viewport);
    } else if (viewport instanceof HTMLElement) {
      return new ElementViewport(viewport);
    } else if (viewport === window) {
      return new WindowViewport();
    }

    let $el = this.$el;
    while ($el.length > 0 && !$el.is(document)) {
      if (_.contains(['auto', 'scroll'], $el.css('overflowY'))) {
        return new ElementViewport($el);
      }
      $el = $el.parent();
    }
    return new WindowViewport();
  }

  _hookUpViewport() {
    this.viewport = this._initViewport();

    if (this.virtualized) {
      let blockUntil = 0;

      const onViewportChange = () => {
        if (performance.now() > blockUntil) {
          this._scheduleRedraw();
        } else if (!this._state.removed) {
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
  }

  /**
   * Whether or not the list view is virtualized
   */
  get virtualized() {
    return this._props.virtualized;
  }

  /**
   * Remove the view and unregister the event listeners.
   */
  remove() {
    this._state.removed = true;
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
    const { invalidation } = this._state;
    const eventsDOM = _.omit(events, LIST_VIEW_EVENTS);
    const eventsListView = _.pick(events, LIST_VIEW_EVENTS);

    if (invalidation & INVALIDATION_EVENTS) {
      this.undelegateEvents();
      _.each(this._state.eventsListView || {}, (handler, event) => {
        this.off(event, handler);
      });
    }
    if (invalidation & INVALIDATION_LIST) {
      const isInternalViewport = _.isString(this._props.viewport);
      if (isInternalViewport && this.viewport) {
        this.viewport.remove();
        this.viewport = null;
      }
      this.$el.html(listTemplate(model));
      if (!this.viewport) {
        this._hookUpViewport();
      }
      this.$topFiller = this.$('.top-filler');
      this.$bottomFiller = this.$('.bottom-filler');
      this._applyPaddings({
        paddingTop: 0,
        paddingBottom: this.itemHeights.read(items.length),
      });
      _.extend(this._state, { indexFirst: 0, indexLast: 0 });
    }
    if (invalidation & INVALIDATION_EVENTS) {
      this.delegateEvents(eventsDOM);
      _.each(eventsListView, (handler, event) => {
        this.on(event, handler);
      });
      this._state.eventsListView = eventsListView;
    }
    const invalidateItems = invalidation & INVALIDATION_ITEMS;

    _.extend(this._state, { invalidation: INVALIDATION_NONE });
    return invalidateItems;
  }

  // Private API, redraw immediately
  _redraw() {
    let invalidateItems = this._processInvalidation();
    const { items, itemTemplate } = this.options;
    const { viewport, itemHeights, $topFiller, $bottomFiller, virtualized } = this;
    let { indexFirst, indexLast, anchor } = this._state;

    if (!invalidateItems && items.length === 0) {
      return;
    }

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
        const targetFirst = virtualized ? itemHeights.lowerBound(visibleTop - listTop) : 0;
        const targetLast = virtualized ? Math.min(itemHeights.upperBound(visibleBot - listTop) + 1, items.length) : items.length;
        const renderFirst = Math.max(targetFirst - 10, 0);
        const renderLast = Math.min(targetLast + 10, items.length);

        let renderMore = false;

        // Clean up
        if (targetFirst >= indexLast || targetLast <= indexFirst || invalidateItems) {
          $topFiller.nextUntil($bottomFiller).remove();
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
          $topFiller.after(items.slice(renderFirst, indexFirst).map(itemTemplate));
          $topFiller.nextUntil($bottomFiller).slice(0, indexFirst - renderFirst).each((offset, el) => {
            itemHeights.writeSingle(renderFirst + offset, el.getBoundingClientRect().height);
          });
          indexFirst = renderFirst;
          renderMore = renderTop = true;
        } else if (renderBot && !renderTop && renderFirst > indexFirst) {
          const removal = [];
          $topFiller.nextUntil($bottomFiller).slice(0, renderFirst - indexFirst).each((offset, el) => removal.push(el));
          $(removal).remove();
          indexFirst = renderFirst;
          renderMore = true;
        }

        // Render bottom
        if (targetLast > indexLast) {
          $bottomFiller.before(items.slice(indexLast, renderLast).map(itemTemplate));
          $topFiller.nextUntil($bottomFiller).slice(indexLast - indexFirst).each((offset, el) => {
            itemHeights.writeSingle(indexLast + offset, el.getBoundingClientRect().height);
          });
          indexLast = renderLast;
          renderMore = renderBot = true;
        } else if (renderTop && !renderBot && renderLast < indexLast) {
          const removal = [];
          $topFiller.nextUntil($bottomFiller).slice(renderLast - indexFirst).each((offset, el) => removal.push(el));
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
    _.extend(this._state, { indexFirst, indexLast, anchor: null });

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
   * Get the rendered DOM element at certain index.
   * @param {number} index The index of the item.
   * @return {HTMLElement}
   */
  elementAt(index) {
    const { indexFirst, indexLast } = this._state;

    if (index < indexFirst || index >= indexLast || !this.$topFiller || !this.$bottomFiller) {
      return null;
    }
    return this.$topFiller.nextUntil(this.$bottomFiller).get(index - indexFirst);
  }

  /**
   * The index of the first rendered item.
   * @type {number}
   */
  get indexFirst() {
    return this._state.indexFirst;
  }

  /**
   * The index after the last rendered item.
   * @type {number}
   */
  get indexLast() {
    return this._state.indexLast;
  }

  /**
   * The total count of the items.
   * @type {number}
   */
  get length() {
    return this.options.items.length;
  }

  /**
   * The model object to render the skeleton of the list view.
   * @type {Object}
   */
  get model() {
    return this.options.model;
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
   * Set the list view options. The following options can be set
   *
   * __model__: The model object to render the skeleton of the list view.
   *
   * __listTemplate__: The template to render the skeleton of the list view.
   *
   *  * By default, it would render a single `UL`.
   *  * __Note__: It must contain the following elements with specified class
   *    names as the first and last siblings of the list items. All list items
   *    will be rendered in between.
   *    * `'top-filler'`: The filler block on top.
   *    * `'bottom-filler'`: The filler block at bottom.
   *
   * __events__: The events hash in form of `{ "event selector": callback }`.
   *
   *  * Refer to {@link http://backbonejs.org/#View-events|Backbone.View~events}
   *  * In addition to the DOM events, it can also handle the `'willRedraw'` and
   *    `'didRedraw'` events of the list view.
   *  * __Note__: The callback __MUST__ be a function. Member function names are
   *    not supported.
   *
   * __items__: The model objects of the list items.
   *
   * __itemTemplate__: The template to render a list item.
   *
   *  * By default, it would render a single `LI` filled with `item.text`.
   *  * __Note__: list items __MUST NOT__ have outer margins, otherwise the layout
   *    calculation will be inaccurate.
   *
   * __defaultItemHeight__: The estimated height of a single item.
   *
   *  * It's not necessary to be accurate. But the accurater it is, the less the
   *    scroll bar is adjusted overtime.
   *
   * Refer to {@link ListView} for detail.
   *
   * @param {Object} options The new options.
   * @param {Object} options.model
   * @param {ListView~cbListTemplate} [options.listTemplate]
   * @param {Object} options.events
   * @param {Object[]} [options.items=[]]
   * @param {ListView~cbItemTemplate} [options.itemTemplate]
   * @param {number} [options.defaultItemHeight=20]
   * @param {function} [callback] The callback to notify completion.
   * @return {ListView} The list view itself.
   */
  set(options = {}, callback = _.noop) {
    const isSet = key => !_.isUndefined(options[key]);
    const itemHeightsCur = this._itemHeights;
    let invalidation = 0;

    _.extend(this.options, options);

    if (_.some(['model', 'listTemplate'], isSet)) {
      invalidation |= INVALIDATION_ALL;
    } else {
      if (_.some(['items', 'itemTemplate', 'defaultItemHeight'], isSet)) {
        if (isSet('defaultItemHeight') ||
          this.itemHeights.maxVal !== this.length) {
          this._itemHeights = null;
        }
        invalidation |= INVALIDATION_ITEMS;
      }
      if (isSet('events')) {
        invalidation |= INVALIDATION_EVENTS;
      }
    }

    if (invalidation) {
      if (this.viewport && this.$topFiller && itemHeightsCur) {
        const visibleTop = this.viewport.getMetrics().outer.top;
        const listTopCur = this.$topFiller.get(0).getBoundingClientRect().top;
        const visibleFirst = itemHeightsCur.lowerBound(visibleTop - listTopCur);

        if (visibleFirst < this.length) {
          const el = this.elementAt(visibleFirst);
          if (el) {
            const elTop = el.getBoundingClientRect().top;
            this._state.anchor = {
              index: visibleFirst,
              top: elTop,
            };
          }
        }
      }

      this._invalidate(invalidation, callback);
    } else {
      callback();
    }

    return this;
  }

  _invalidate(invalidation, callback) {
    this._state.invalidation |= invalidation;
    this._scheduleRedraw(true);
    this.once('didRedraw', callback);
  }

  /**
   * Invalidate the already rendered items and schedule another redraw.
   * @param {function} [callback] The callback to notify completion.
   */
  invalidate(callback = _.noop) {
    this._invalidate(INVALIDATION_ITEMS, callback);
  }

  /**
   * Scroll to a certain item.
   * @param {number} index The index of the item.
   * @param {string|number} [position='default'] The position of the item.
   *
   * The valid positions are
   *   * `'default'`, if the item is above the viewport top, scroll it to the
   *     top, if the item is below the viewport bottom, scroll it to the bottom,
   *     otherwise, keep the viewport unchanged.
   *   * `'top'`, scroll the item to top of the viewport.
   *   * `'middle'`, scroll the item to the vertical center of the viewport.
   *   * `'bottom'`, scroll the item to the bottom of the viewport.
   *   * `{number}`, scroll the item to the given offset from the viewport top.
   *
   * @param {function} [callback] The callback to notify completion.
   *
   */
  scrollToItem(...args) {
    if (!this.$topFiller || !this.$bottomFiller) {
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
      this._state.anchor = {
        index,
        top: visibleTop,
      };
    } else if (pos === 'bottom') {
      this._state.anchor = {
        index: index + 1,
        top: visibleBot,
      };
    } else if (pos === 'middle') {
      this._state.anchor = {
        index: index,
        top: (visibleTop + visibleBot + itemTop - itemBot) / 2,
        isMiddle: true,
      };
    } else if (typeof pos === 'number') {
      this._state.anchor = {
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
    let requestId = null;
    const redraw = () => {
      if (!this._state.removed) {
        this._redraw();
      }
    };

    this._scheduleRedraw = (ignoreAnimationFrame = false) => {
      if (ignoreAnimationFrame) {
        if (requestId) {
          window.cancelAnimationFrame(requestId);
          requestId = null;
        }
        _.defer(redraw);
      } else if (!requestId) {
        requestId = window.requestAnimationFrame(() => {
          requestId = null;
          redraw();
        });
      }
    };
    // this._hookUpViewport();
    this._invalidate(INVALIDATION_ALL, callback);
    return this;
  }

}

export default ListView;
