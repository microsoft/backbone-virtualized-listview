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

    this.topPadding = 0;
    this.bottomPadding = defaultItemHeight * this.items.length;

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

  redraw() {
    const { top, bottom } = this.getVisibleArea();
    const indexFirst = Math.floor(top / this.defaultItemHeight);
    const indexLast = Math.ceil(bottom / this.defaultItemHeight);

    if (indexFirst < this.indexFirst) {
      _.map(this.collection.slice this.itemTemplate()
    }

    console.log(`${top} -> ${bottom}`);
  }

  rowWithCid(cid) {
    return this.$(`[data-cid=${cid}]`);
  }

  render() {
    this.$el.html(this.listTemplate());
    this.$el.css({ position: 'relative' });
    this.items.forEach(item => {
      const $item = $(this.itemTemplate(item.toJSON()));

      $item.attr('data-cid', item.cid);
      this.$('.container').append($item);
    });
    return this;
  }

}

export default ListView;
