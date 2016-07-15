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

/**
 * The virtualized list view class.
 *
 * @param {Object} options
 * The constructor options.
 *
 * @param {function} [options.listTemplate]
 * The template of the list view.
 *
 * It must contain an empty element with class name `'list-container'`, as
 * the parrent of all list items.
 *
 * By default, it would render a single `UL`.
 *
 * @param {function} [options.itemTemplate]
 * The template of the list items.
 *
 * Note: list items **MUST NOT** have outer margins, otherwise the layout
 * calculation will be inaccurate.
 *
 * By default, it would render a single `LI` filled with `item.text`.
 *
 * @param {Object[]} [options.items=[]]
 * The list data items.
 *
 * @param {number} [options.defaultItemHeight=20]
 * The estimated height of a single item.
 *
 * It's not necessary to be accurate. But the accurater it is, the less
 * the scroll bar is adjusted overtime.
 *
 * @param {string} [options.viewport]
 * The CSS selector to locate the scrollable viewport.
 *
 * If it's omitted, the `window` will be used as the viewport.
 *
 */
class ListView extends Backbone.View {

  /**
   * Backbone view initializer
   * @see ListView
   */
  initialize({
    listTemplate = defaultListTemplate,
    itemTemplate = defaultItemTemplate,
    events = {},
    items = [],
    defaultItemHeight = 20,
    viewport = null,
  } = {}) {
    this.listTemplate = listTemplate;
    this.itemTemplate = itemTemplate;
    this.events = events;
    this.items = items;
    this.viewport = viewport ? new ElementViewport(viewport) : new WindowViewport();

    // States
    this.indexFirst = 0;
    this.indexLast = 0;
    this.itemHeights = new BinaryIndexedTree({
      defaultFrequency: Math.max(defaultItemHeight, 1),
      maxVal: items.length,
    });

    this.anchor = null;
    this.invalidated = false;

    // Events
    this._scheduleRedraw = (() => {
      let requestId = null;

      return () => {
        if (!requestId) {
          requestId = window.requestAnimationFrame(() => {
            requestId = null;
            this._redraw();
          });
        }
      };
    })();

    this.viewport.on('change', this._scheduleRedraw);
  }

  /**
   * Remove the view and unregister the event listeners.
   */
  remove() {
    this.viewport.remove();
    super.remove();
  }

  // Private API, redraw immediately
  _redraw() {
    const { viewport, itemHeights, $container, items, itemTemplate } = this;
    let { indexFirst, indexLast, anchor, invalidated } = this;

    const metricsViewport = viewport.getMetrics();
    const visibleTop = metricsViewport.outer.top;
    const visibleBot = metricsViewport.outer.bottom;
    const rectContainer = $container.get(0).getBoundingClientRect();

    if (!anchor) {
      anchor = {
        index: indexFirst,
        top: rectContainer.top + itemHeights.read(indexFirst),
      };
    }

    let renderTop = false;
    let renderBot = false;

    whileTrue(() => {
      const listTop = anchor.top - itemHeights.read(anchor.index);
      const targetFirst = itemHeights.lowerBound(visibleTop - listTop);
      const targetLast = Math.min(itemHeights.upperBound(visibleBot - listTop) + 1, items.length);
      const renderFirst = Math.max(targetFirst - 10, 0);
      const renderLast = Math.min(targetLast + 10, items.length);

      let renderMore = false;

      // Clean up
      if (targetFirst >= indexLast || targetLast <= indexFirst || invalidated) {
        $container.empty();
        indexFirst = indexLast = targetFirst;
        invalidated = false;
        if (targetFirst !== targetLast && items.length > 0) {
          renderMore = true;
        }
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
      this.$container.css({
        paddingTop: itemHeights.read(indexFirst),
        paddingBottom: itemHeights.read(items.length) - itemHeights.read(indexLast),
      });
    }

    // Adjust the scroll if it's changed significantly
    const listTop = anchor.top - itemHeights.read(anchor.index);
    const innerTop = listTop - (rectContainer.top - metricsViewport.inner.top);
    const scrollTop = Math.round(visibleTop - innerTop);

    if (Math.abs(scrollTop - metricsViewport.scroll.y) >= 1) {
      this.viewport.scrollTo({ y: scrollTop });
      this._scheduleRedraw();
    }

    // Write back the render state
    this.indexFirst = indexFirst;
    this.indexLast = indexLast;
    this.invalidated = false;

    // Do a second scroll for a middle anchor after the item is rendered
    if (anchor.isMiddle) {
      const index = anchor.index;
      const itemTop = rectContainer.top + this.itemHeights.read(index);
      const itemBot = rectContainer.top + this.itemHeights.read(index + 1);

      this.anchor = {
        index,
        top: (visibleTop + visibleBot + itemTop - itemBot) / 2,
      };
      this._scheduleRedraw();
    } else {
      this.anchor = null;
    }
  }

  /**
   * Reset the items and defaultItemHeight.
   * @param {Object} options
   * @param {Object[]} [options.items] The new data items.
   * @param {number} [options.defaultItemHeight] The new estimated item height.
   */
  reset({
    items = this.items,
    defaultItemHeight = this.itemHeights.defaultFrequency,
  } = {}) {
    this.items = items;
    this.defaultItemHeight = defaultItemHeight;
    this.itemHeights = new BinaryIndexedTree({
      defaultFrequency: defaultItemHeight,
      maxVal: items.length,
    });
    this.invalidate();
  }

  /**
   * Reset the items. Short-cut for `listView.reset({ items })`.
   * @param {Object[]} items The new data items.
   */
  setItems(items) {
    this.reset({ items });
  }

  /**
   * Reset the estimated item height.
   * @param {number} defaultItemHeight The new estimated item height.
   */
  setDefaultItemHeight(defaultItemHeight) {
    this.reset({ defaultItemHeight });
  }

  /**
   * Invalidate the already rendered items and schedule another redraw.
   */
  invalidate() {
    this.invalidated = true;
    this._scheduleRedraw();
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
   */
  scrollToItem(index, position = 'default') {
    const metricsViewport = this.viewport.getMetrics();
    const visibleTop = metricsViewport.outer.top;
    const visibleBot = metricsViewport.outer.bottom;
    const rectContainer = this.$container.get(0).getBoundingClientRect();
    const itemTop = rectContainer.top + this.itemHeights.read(index);
    const itemBot = rectContainer.top + this.itemHeights.read(index + 1);
    let pos = position;

    if (pos === 'default') {
      if (itemTop < visibleTop) {
        pos = 'top';
      } else if (itemBot > visibleBot) {
        pos = 'bottom';
      } else {
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

    this._scheduleRedraw();
  }

  /**
   * Render the list view.
   */
  render() {
    this.$el.html(this.listTemplate());
    this.$container = this.$('.list-container');
    this.$container.css({ paddingBottom: this.itemHeights.read(this.items.length) });
    this._scheduleRedraw();
    return this;
  }

}

export default ListView;
