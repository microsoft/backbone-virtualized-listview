import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';
import defaultListTemplate from './default-list.jade';
import defaultItemTemplate from './default-item.jade';

class Viewport {

  get top() {
    return 0;
  }

  get height() {
    return 0;
  }

  get bottom() {
    return this.top + this.height;
  }
}

class WindowViewport extends Viewport {

  constructor() {
    super();
    this.$el = $(window);
  }

  get top() {
    // return window.scrollY;
    return 0;
  }

  get height() {
    return window.innerHeight;
  }

  get scrollTop() {
    return window.scrollY;
  }

  set scrollTop(scrollTop) {
    window.scrollY = scrollTop;
  }
}

class ElementViewport extends Viewport {
  constructor(selector) {
    super();
    this.$el = $(selector);
  }

  get top() {
    return this.$el.get(0).getBoundingClientRect().top;
  }

  get height() {
    return this.$el.height();
  }

  get scrollTop() {
    return this.$el.scrollTop();
  }

  set scrollTop(scrollTop) {
    this.$el.scrollTop(scrollTop);
  }
}

const stateProperties = [
  'indexFirst',
  'indexLast',
  'topPadding',
  'bottomPadding',
  'contentHeight',
  'itemHeight',
];

class RedrawContext {
  constructor(listView) {
    this.listView = listView;
    _.extend(this, _.pick(listView, stateProperties));
    this.scrollTop = listView.viewport.scrollTop;

    const contentRect = this.listView.$container.get(0).getBoundingClientRect();
    this.contentTop = contentRect.top;
    this.contentHeight = this.listView.$innerContainer.height();
    this.contentBottom = contentRect.top + this.contentHeight;
    this.visibleHeight = this.listView.viewport.height;
    this.visibleTop = Math.max(this.listView.viewport.top - this.contentTop, 0);
    this.visibleBottom = this.visibleTop + this.visibleHeight;
  }

  get renderedTop() {
    return this.topPadding;
  }

  get renderedBottom() {
    return this.topPadding + this.contentHeight;
  }

  clear() {
    this.listView.$innerContainer.empty();
    const index = Math.floor(this.visibleTop / this.itemHeight);
    this.topPadding = index * this.itemHeight;
    this.bottomPadding = (this.listView.items.length - index) * this.itemHeight;
    this.indexFirst = this.indexLast = index;
    this.contentHeight = 0;
  }

  commit() {
    _.extend(this.listView, _.pick(this, stateProperties));
    this.listView.scrollTop = this.scrollTop;
    this.listView.$container.css({
      'padding-top': this.topPadding,
      'padding-bottom': this.bottomPadding,
    });
  }

  locateElement(el) {
    const { top, bottom, height } = el.getBoundingClientRect();
    const delta = -this.contentTop + this.topPadding - this.listView.topPadding;
    return {
      top: top + delta,
      bottom: bottom + delta,
      height,
    };
  }

  renderTop(index) {
    this.listView.$innerContainer.prepend(_.map(
      this.listView.items.slice(index, this.indexFirst),
      _.compose(this.listView.itemTemplate, m => m.toJSON())
    ));

    const contentHeightNew = this.listView.$innerContainer.height();
    const delta = contentHeightNew - this.contentHeight;

    this.topPadding -= delta;
    this.indexFirst = index;
    this.contentHeight = contentHeightNew;
  }

  renderBottom(index) {
    this.listView.$innerContainer.append(_.map(
      this.listView.items.slice(this.indexLast, index),
      _.compose(this.listView.itemTemplate, m => m.toJSON())
    ));

    const contentHeightNew = this.listView.$innerContainer.height();
    const delta = contentHeightNew - this.contentHeight;

    this.bottomPadding -= delta;
    this.indexLast = index;
    this.contentHeight = contentHeightNew;
  }

  purge(range) {
    const removal = [];
    const state = _.pick(this, stateProperties);

    this.listView.$innerContainer.children().each((index, el) => {
      const { top, bottom, height } = this.locateElement(el);

      if (bottom < range.top) {
        removal.push(el);
        state.topPadding += height;
        state.contentHeight -= height;
        state.indexFirst++;
      } else if (top > range.bottom) {
        removal.push(el);
        state.bottomPadding += height;
        state.contentHeight -= height;
        state.indexLast--;
      }
    });

    $(removal).remove();
    _.extend(this, state);
  }

  updateItemHeight() {
    this.itemHeight = this.contentHeight / (this.indexLast - this.indexFirst);
    const topPaddingNew = this.itemHeight * this.indexFirst;
    if (Math.abs(topPaddingNew - this.topPadding) > 0.001) {
      this.scrollTop += topPaddingNew - this.topPadding;
      this.topPadding = topPaddingNew;
    }

    this.bottomPadding = this.itemHeight * (this.listView.items.length - this.indexLast);
  }
}

class ListView extends Backbone.View {
  initialize({
    listTemplate = defaultListTemplate,
    itemTemplate = defaultItemTemplate,
    items = [],
    events = {},
    viewport = null,
    defaultItemHeight = 20,
  }) {
    this.items = new Backbone.Collection(items);
    this.listTemplate = listTemplate;
    this.itemTemplate = itemTemplate;
    this.events = events;
    this.viewport = viewport ? new ElementViewport(viewport) : new WindowViewport();

    // States
    this.itemHeight = defaultItemHeight;
    this.indexFirst = 0;
    this.indexLast = 0;
    this.topPadding = 0;
    this.bottomPadding = this.itemHeight * this.items.length;
    this.contentHeight = 0;

    // Events
    this.redraw = this.redraw.bind(this);
    this.viewport.$el.on('scroll', this.redraw);
    this.viewport.$el.on('resize', this.redraw);
  }

  remove() {
    this.viewport.$el.off('scroll', this.redraw);
    this.viewport.$el.off('resize', this.redraw);
  }

  redraw() {
    const context = new RedrawContext(this);

    let finished = false;

    if (context.renderedTop > context.visibleBottom || context.renderedBottom < context.visibleTop) {
      context.clear();
    }

    while (!finished) {
      if (context.renderedTop > context.visibleTop && context.indexFirst > 0) {
        const count = Math.ceil((context.renderedTop - context.visibleTop) / context.itemHeight);
        const index = Math.max(context.indexFirst - count, 0);

        context.renderTop(index);
      } else if (context.renderedBottom < context.visibleBottom && context.indexLast < this.items.length) {
        const count = Math.ceil((context.visibleBottom - context.renderedBottom) / context.itemHeight);
        const index = Math.min(context.indexLast + count, this.items.length);

        context.renderBottom(index);
      } else {
        finished = true;
      }
    }

    context.purge({
      top: context.visibleTop - context.visibleHeight / 2,
      bottom: context.visibleBottom + context.visibleHeight / 2,
    });

    context.updateItemHeight();

    context.commit();
  }

  render() {
    this.$el.html(this.listTemplate());
    this.$el.css({ position: 'relative' });
    this.$innerContainer = $('<div/>');
    this.$container = this.$('.container');
    this.$container.html(this.$innerContainer);
    window.setTimeout(() => this.redraw(), 0);
    return this;
  }

}

export default ListView;
