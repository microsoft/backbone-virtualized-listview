import $ from 'jquery';
import Backbone from 'backbone';
import BinaryIndexedTree from 'fast-binary-indexed-tree';

import defaultListTemplate from './default-list.jade';
import defaultItemTemplate from './default-item.jade';
import { ElementViewport, WindowViewport } from './viewport.js';

const forever = func => {
  while (func());
};

class ListView extends Backbone.View {
  initialize({
    listTemplate = defaultListTemplate,
    itemTemplate = defaultItemTemplate,
    events = {},
    items = [],
    defaultItemHeight = 20,
    viewport = null,
  }) {
    this.listTemplate = listTemplate;
    this.itemTemplate = itemTemplate;
    this.events = events;
    this.items = items;
    this.viewport = viewport ? new ElementViewport(viewport) : new WindowViewport();

    // States
    this.indexFirst = 0;
    this.indexLast = 0;
    this.itemHeights = new BinaryIndexedTree({
      defaultFrequency: defaultItemHeight,
      maxVal: items.length,
    });

    this.anchor = null;
    this.invalidated = false;

    // Events
    this.scheduleRedraw = (() => {
      let requestId = null;

      return () => {
        if (!requestId) {
          requestId = window.requestAnimationFrame(() => {
            requestId = null;
            this.redraw();
          });
        }
      };
    })();

    this.viewport.on('change', this.scheduleRedraw);
  }

  remove() {
    this.viewport.remove();
    super.remove();
  }

  redraw() {
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

    forever(() => {
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
        if (items.length > 0) {
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
      this.scheduleRedraw();
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
      this.scheduleRedraw();
    } else {
      this.anchor = null;
    }
  }

  reset({
    items = this.items,
    defaultItemHeight = this.defaultItemHeight,
  }) {
    this.items = items;
    this.defaultItemHeight = defaultItemHeight;
    this.itemHeights = new BinaryIndexedTree({
      defaultFrequency: defaultItemHeight,
      maxVal: items.length,
    });
    this.invalidate();
    this.scheduleRedraw();
  }

  setItems(items) {
    this.reset({ items });
  }

  invalidate() {
    this.invalidated = true;
  }

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

    this.scheduleRedraw();
  }

  render() {
    this.$el.html(this.listTemplate());
    this.$container = this.$('.list-container');
    this.$container.css({ paddingBottom: this.itemHeights.read(this.items.length) });
    this.scheduleRedraw();
    return this;
  }

}

export default ListView;
