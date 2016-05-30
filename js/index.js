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
    console.log(visibleArea);
    const renderedArea = this.getRenderedArea();
    let {
      topPadding,
      bottomPadding,
      indexFirst,
      indexLast,
      itemHeight,
    } = this;
    let scrollTop = this.viewport.scrollTop;
    let finished = false;
    let containerHeight = this.$('.container').height();

    if (renderedArea.top > visibleArea.bottom || renderedArea.bottom < visibleArea.top) {
      this.$('.container').empty();
      const index = Math.floor(visibleArea.top / itemHeight);
      topPadding = index * itemHeight;
      bottomPadding = (this.items.length - index) * itemHeight;
      indexFirst = indexLast = index;
      renderedArea.top = renderedArea.bottom = visibleArea.top;
    }

    while (!finished) {
      if (renderedArea.top > visibleArea.top && indexFirst > 0) {
        const count = Math.ceil((renderedArea.top - visibleArea.top) / itemHeight);
        const index = Math.max(indexFirst - count, 0);

        this.$('.container').prepend(_.map(
          this.items.slice(index, indexFirst),
          _.compose(this.itemTemplate, m => m.toJSON())
        ));

        const containerHeightNew = this.$('.container').height();
        const delta = containerHeightNew - containerHeight;
        topPadding -= delta;
        renderedArea.top -= delta;
        indexFirst = index;
        containerHeight = containerHeightNew;
      } else if (renderedArea.bottom < visibleArea.bottom && indexLast < this.items.length) {
        const count = Math.ceil((visibleArea.bottom - renderedArea.bottom) / itemHeight);
        const index = Math.min(indexLast + count, this.items.length);

        this.$('.container').append(_.map(
          this.items.slice(indexLast, index),
          _.compose(this.itemTemplate, m => m.toJSON())
        ));

        const containerHeightNew = this.$('.container').height();
        const delta = containerHeightNew - containerHeight;
        bottomPadding -= delta;
        renderedArea.bottom += delta;
        indexLast = index;
        containerHeight = containerHeightNew;
      } else {
        finished = true;
      }
    }
    const removal = [];
    const rectContainer = this.$('.container').get(0).getBoundingClientRect();
    const delta = -rectContainer.top + topPadding - this.topPadding;
    this.$('.container').children().each((index, el) => {
      let { top, bottom, height } = el.getBoundingClientRect();

      top += delta;
      bottom += delta;

      if (bottom < visibleArea.top - this.viewport.height / 2) {
        removal.push(el);
        renderedArea.top += height;
        topPadding += height;
        containerHeight -= height;
        indexFirst++;
      } else if (top > visibleArea.bottom + this.viewport.height / 2) {
        removal.push(el);
        renderedArea.bottom -= height;
        bottomPadding += height;
        containerHeight -= height;
        indexLast--;
      }
    });

    _.each(removal, node => node.remove());

    itemHeight = containerHeight / (indexLast - indexFirst);
    const topPaddingNew = itemHeight * indexFirst;
    if (Math.abs(topPaddingNew - topPadding) > 0.001) {
      scrollTop += topPaddingNew - topPadding;
      topPadding = topPaddingNew;
    }

    bottomPadding = itemHeight * (this.items.length - indexLast);

    _.extend(this, {
      topPadding,
      bottomPadding,
      indexFirst,
      indexLast,
      itemHeight,
    });

    console.log(topPadding);
    this.$('.container').css({
      'padding-top': topPadding,
      'padding-bottom': bottomPadding,
    });
    this.viewport.scrollTop = scrollTop;
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
