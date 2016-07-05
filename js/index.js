import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';
import defaultListTemplate from './default-list.jade';
import defaultItemTemplate from './default-item.jade';
import { ElementViewport, WindowViewport } from './viewport.js';
import { RenderContext } from './render-context.js';

class ListView extends Backbone.View {
  initialize({
    listTemplate = defaultListTemplate,
    itemTemplate = defaultItemTemplate,
    events = {},
    items = [],
    viewport = null,
    defaultItemHeight = 20,
  }) {
    this.listTemplate = listTemplate;
    this.itemTemplate = itemTemplate;
    this.events = events;
    this.items = items;
    this.viewport = viewport ? new ElementViewport(viewport) : new WindowViewport();

    // States
    this.indexFirst = 0;
    this.indexLast = 0;
    this.itemHeight = defaultItemHeight;

    // Events
    this.scheduleRedraw = (() => {
      let requestId = null;

      return options => {
        if (requestId !== null) {
          window.cancelAnimationFrame(requestId);
        }
        requestId = window.requestAnimationFrame(() => {
          requestId = null;
          this.redraw(options);
        });
      };
    })();

    this.viewport.on('change', this.scheduleRedraw);
  }

  remove() {
    this.viewport.remove();
    super.remove();
  }

  redraw({
    clear = false,
    anchor = null,
  } = {}) {
    const context = new RenderContext(this);
    const { metrics, state }  = context;

    if (anchor) {
      context.scrollToAnchor(anchor);
    }

    if (clear ||
      metrics.itemsTop > metrics.visibleBot ||
      metrics.itemsBot < metrics.visibleTop) {
      context.clear();
    }

    let finished = false;

    while (!finished) {
      if (metrics.itemsTop > metrics.visibleTop && state.indexFirst > 0) {
        const count = Math.ceil((metrics.itemsTop - metrics.visibleTop) / state.itemHeight);
        const index = Math.max(state.indexFirst - count, 0);

        context.renderTop(index);
      } else if (metrics.itemsBot < metrics.visibleBot && state.indexLast < this.items.length) {
        const count = Math.ceil((metrics.visibleBot - metrics.itemsBot) / state.itemHeight);
        const index = Math.min(state.indexLast + count, this.items.length);

        context.renderBottom(index);
      } else {
        finished = true;
      }
    }

    context.purge({
      top: metrics.visibleTop - metrics.visibleHeight / 2,
      bottom: metrics.visibleBot + metrics.visibleHeight / 2,
    });

    context.commit();
  }

  setItems(items) {
    this.items = items;
    this.scheduleRedraw({ clear: true });
  }

  scrollToItem(index, position = 0) {
    const metricsVP = this.viewport.getMetrics();
    const anchor = { index, position };
    this.scheduleRedraw({ anchor });
  }

  render() {
    this.$el.html(this.listTemplate());
    this.$el.css({ position: 'relative' });
    this.$innerContainer = $('<div/>');
    this.$container = this.$('.list-container');
    this.$container.css({ paddingBottom: this.itemHeight * this.items.length });
    this.$container.html(this.$innerContainer);
    this.scheduleRedraw();
    return this;
  }

}

export default ListView;
