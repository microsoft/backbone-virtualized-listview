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
    return window.scrollY;
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
    return this.$el.offset().top;
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
  'itemHeight',
];

class RedrawContext {
  constructor(listView) {
    this.listView = listView;
    _.extend(this, _.pick(listView, stateProperties));
    this.scrollTop = listView.viewport.scrollTop;

    const contentRect = this.listView.$container.get(0).getBoundingClientRect();
    this.contentTop = contentRect.top;
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

  transaction(callback) {
    const innerContext = _.clone(this);

    callback(innerContext);
    _.extend(this, innerContext);
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
    this.itemHeight = defaultItemHeight;

    this.indexFirst = 0;
    this.indexLast = 0;
    this.topPadding = 0;
    this.bottomPadding = this.itemHeight * this.items.length;

    this.redraw = this.redraw.bind(this);
    this.viewport.$el.on('scroll', this.redraw);
    this.viewport.$el.on('resize', this.redraw);
  }

  remove() {
    this.viewport.$el.off('scroll', this.redraw);
    this.viewport.$el.off('resize', this.redraw);
  }

  getVisibleArea() {
    const topViewport = this.viewport.top;
    const botViewport = this.viewport.bottom;
    const topContent = _.result(this.$('.container').offset(), 'top', 0);
    return {
      top: Math.max(topViewport - topContent, 0),
      bottom: Math.max(botViewport - topContent, 0),
    };
  }

  getRenderedArea() {
    const topRendered = this.topPadding;
    const botRendered = this.topPadding + this.$('.container').height();
    return {
      top: topRendered,
      bottom: botRendered,
    };
  }

  redraw() {
    const visibleArea = this.getVisibleArea();
    const renderedArea = this.getRenderedArea();
    const context = new RedrawContext(this);

    let finished = false;
    let containerHeight = this.$('.container').height();

    if (renderedArea.top > visibleArea.bottom || renderedArea.bottom < visibleArea.top) {
      this.$('.container').empty();
      const index = Math.floor(visibleArea.top / context.itemHeight);
      context.topPadding = index * context.itemHeight;
      context.bottomPadding = (this.items.length - index) * context.itemHeight;
      context.indexFirst = context.indexLast = index;
      renderedArea.top = renderedArea.bottom = visibleArea.top;
    }

    while (!finished) {
      if (renderedArea.top > visibleArea.top && context.indexFirst > 0) {
        const count = Math.ceil((renderedArea.top - visibleArea.top) / context.itemHeight);
        const index = Math.max(context.indexFirst - count, 0);

        this.$('.container').prepend(_.map(
          this.items.slice(index, context.indexFirst),
          _.compose(this.itemTemplate, m => m.toJSON())
        ));

        const containerHeightNew = this.$('.container').height();
        const delta = containerHeightNew - containerHeight;
        context.topPadding -= delta;
        renderedArea.top -= delta;
        context.indexFirst = index;
        containerHeight = containerHeightNew;
      } else if (renderedArea.bottom < visibleArea.bottom && context.indexLast < this.items.length) {
        const count = Math.ceil((visibleArea.bottom - renderedArea.bottom) / context.itemHeight);
        const index = Math.min(context.indexLast + count, this.items.length);

        this.$('.container').append(_.map(
          this.items.slice(context.indexLast, index),
          _.compose(this.itemTemplate, m => m.toJSON())
        ));

        const containerHeightNew = this.$('.container').height();
        const delta = containerHeightNew - containerHeight;
        context.bottomPadding -= delta;
        renderedArea.bottom += delta;
        context.indexLast = index;
        containerHeight = containerHeightNew;
      } else {
        finished = true;
      }
    }
    const removal = [];

    context.transaction(innerContext => {
      this.$container.children().each((index, el) => {
        const { top, bottom, height } = context.locateElement(el);

        if (bottom < visibleArea.top - this.viewport.height / 2) {
          removal.push(el);
          renderedArea.top += height;
          innerContext.topPadding += height;
          containerHeight -= height;
          innerContext.indexFirst++;
        } else if (top > visibleArea.bottom + this.viewport.height / 2) {
          removal.push(el);
          renderedArea.bottom -= height;
          innerContext.bottomPadding += height;
          containerHeight -= height;
          innerContext.indexLast--;
        }
      });
    });

    _.each(removal, node => node.remove());

    context.itemHeight = containerHeight / (context.indexLast - context.indexFirst);
    const topPaddingNew = context.itemHeight * context.indexFirst;
    if (Math.abs(topPaddingNew - context.topPadding) > 0.001) {
      context.scrollTop += topPaddingNew - context.topPadding;
      context.topPadding = topPaddingNew;
    }

    context.bottomPadding = context.itemHeight * (this.items.length - context.indexLast);

    context.commit();
  }

  render() {
    this.$el.html(this.listTemplate());
    this.$el.css({ position: 'relative' });
    this.$container = this.$('.container');
    window.setTimeout(() => this.redraw(), 0);
    return this;
  }

}

export default ListView;
