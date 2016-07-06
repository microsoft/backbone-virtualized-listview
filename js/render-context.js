import $ from 'jquery';
import _ from 'underscore';

/*
 *         elHeight                    scrollTop
 * +------+ <--=---------------------------=----------------------- elTop
 * |      |    |                           |
 * |      |    | listHeight                | paddingTop
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
 * +------+ <--+-----+-----+-------V-------------------------- visibleBot
 * |XXXXXX|    |     |     |
 * |XXXXXX|    |     |     |                 paddingBot
 * +------+ <--+-----+-----V---------------------=-------------- itemsBot
 * |      |    |     |                           |
 * |      |    |     |                           |
 * +------+ <--+-----V---------------------------V--------------- listBot
 * |      |    |
 * |      |    |
 * +------+ <--V--------------------------------------------------- elBot
 *
 */

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

class Metrics {
  constructor(options) {
    this.set(options);
  }

  set(options) {
    _.extend(this, _.pick(options, metricsProperties));
  }

  get elBot() {
    return this.elTop + this.elHeight;
  }

  get visibleBot() {
    return this.visibleTop + this.visibleHeight;
  }

  get listBot() {
    return this.listTop + this.listHeight;
  }

  get itemsBot() {
    return this.itemsTop + this.itemsHeight;
  }

  get paddingTop() {
    return this.itemsTop - this.listTop;
  }

  get paddingBot() {
    return this.listBot - this.itemsBot;
  }
}

const stateProperties = ['indexFirst', 'indexLast', 'itemHeight'];

function defaultAnchor({ metrics, state, listView }) {
  const { visibleTop, visibleBot, listTop } = metrics;
  const { indexFirst, indexLast, itemHeight } = state;
  const { $container } = listView;

  const indexTop = Math.floor((visibleTop - listTop) / itemHeight);
  const indexBot = Math.ceil((visibleBot - listTop) / itemHeight);
  let index = (indexTop + indexBot) >> 1;

  if (indexFirst <= indexTop && indexTop < indexLast) {
    index = indexTop;
  } else if (indexFirst <= indexBot && indexBot < indexLast) {
    index = indexBot;
  } else if (indexTop <= indexFirst && indexFirst < indexBot) {
    index = indexFirst;
  } else if (indexTop <= indexLast && indexLast < indexBot) {
    index = indexLast;
  }

  const el = $container.children().get(index - indexFirst);
  const top = el ? el.getBoundingClientRect().top : index * itemHeight + listTop;

  return { index, top };
}

function getChildrenMetrics($container) {
  const $children = $container.children();
  if ($children.length > 0) {
    const [rectFirst, rectLast] = _.map([
      $children.first(),
      $children.last(),
    ], $el => $el.get(0).getBoundingClientRect());

    return {
      top: rectFirst.top,
      bottom: rectLast.bottom,
    };
  }
  return null;
}

export class RenderContext {
  constructor(listView) {
    this.listView = listView;
    this.viewport = listView.viewport;
    this.state = _.pick(listView, stateProperties);
    this.metrics = this.measure();
    this.anchor = defaultAnchor(this);
    this.changed = false;

    this.elementHeightCache = {};
  }

  measure() {
    const { $container } = this.listView;
    const { indexFirst, indexLast, itemHeight } = this.state;
    const rectContainer = $container.get(0).getBoundingClientRect();
    const metricsItems = getChildrenMetrics($container) || {
      top: rectContainer.top + indexFirst * itemHeight,
      bottom: rectContainer.top + indexLast * itemHeight,
    };
    const metricsVP = this.viewport.getMetrics();

    return new Metrics({
      elTop: metricsVP.inner.top,
      elHeight: metricsVP.inner.height,

      visibleTop: metricsVP.outer.top,
      visibleHeight: metricsVP.outer.height,

      listTop: rectContainer.top,
      listHeight: rectContainer.height,

      itemsTop: metricsItems.top,
      itemsHeight: metricsItems.bottom - metricsItems.top,

      scrollTop: metricsVP.scroll.y,
    });
  }

  commit() {
    if (this.changed) {
      _.extend(this.listView, _.pick(this.state, stateProperties));
      this.listView.$container.css({
        paddingTop: this.metrics.paddingTop,
        paddingBottom: this.metrics.paddingBot,
      });
      this.viewport.scrollTo({ y: this.metrics.scrollTop });
    }
  }

  normalize() {
    const { indexFirst, indexLast } = this.state;
    const { visibleTop, itemsHeight } = this.metrics;
    let itemHeight = this.state.itemHeight;

    if (indexFirst < indexLast) {
      itemHeight = itemsHeight / (indexLast - indexFirst);
    }

    const listHeight = itemHeight * this.listView.items.length;
    const elHeight = this.metrics.elHeight + listHeight - this.metrics.listHeight;
    const listTop = this.anchor.top - itemHeight * this.anchor.index;
    const itemsTop = listTop + itemHeight * indexFirst;
    const elTop = this.metrics.elTop + listTop - this.metrics.listTop;
    const scrollTop = Math.min(Math.max(visibleTop - elTop, 0), elHeight);

    this.metrics.set({
      elTop,
      elHeight,
      listTop,
      listHeight,
      itemsTop,
      scrollTop,
    });

    this.state.itemHeight = itemHeight;
  }

  clear() {
    const { itemHeight } = this.state;
    const { visibleTop, listTop } = this.metrics;
    let { indexFirst, indexLast } = this.state;
    let { itemsTop, itemsHeight } = this.metrics;
    let index = Math.floor((visibleTop - listTop) / itemHeight);

    index = Math.max(index, 0);
    index = Math.min(index, this.listView.items.length - 1);
    indexFirst = indexLast = index;
    itemsTop = listTop + itemHeight * indexFirst;
    itemsHeight = 0;

    this.listView.$container.empty();
    _.extend(this.state, { indexFirst, indexLast });
    _.extend(this.metrics, { itemsTop, itemsHeight });

    this.changed = true;
  }

  renderTop(index) {
    if (index < this.state.indexFirst) {
      this.listView.$container.prepend(_.map(
        this.listView.items.slice(index, this.state.indexFirst),
        this.listView.itemTemplate
      ));

      const metricsItems = getChildrenMetrics(this.listView.$container);
      const itemsHeight = metricsItems.bottom - metricsItems.top;

      this.metrics.itemsTop -= itemsHeight - this.metrics.itemsHeight;
      this.metrics.itemsHeight = itemsHeight;
      this.state.indexFirst = index;

      this.normalize();
      this.changed = true;
    }
  }

  renderBottom(index) {
    if (index > this.state.indexLast) {
      this.listView.$container.append(_.map(
        this.listView.items.slice(this.state.indexLast, index),
        this.listView.itemTemplate
      ));

      const metricsItems = getChildrenMetrics(this.listView.$container);
      const itemsHeight = metricsItems.bottom - metricsItems.top;

      this.metrics.itemsHeight = itemsHeight;
      this.state.indexLast = index;

      this.normalize();
      this.changed = true;
    }
  }

  getElementHeight(index, el) {
    const indexItem = this.state.indexFirst + index;
    if (!_.has(this.elementHeightCache, indexItem)) {
      this.elementHeightCache[indexItem] = el.getBoundingClientRect().height;
    }
    return this.elementHeightCache[indexItem];
  }

  purge({ top, bottom }) {
    const removal = [];
    let { indexFirst, indexLast } = this.state;
    let { itemsTop, itemsHeight } = this.metrics;
    let elemTop = itemsTop;

    this.listView.$container.children().each((index, el) => {
      const height = this.getElementHeight(index, el);
      const elemBot = elemTop + height;

      if (elemBot < top) {
        removal.push(el);
        itemsTop += height;
        itemsHeight -= height;
        indexFirst++;
      } else if (elemTop > bottom) {
        removal.push(el);
        itemsHeight -= height;
        indexLast--;
      }

      elemTop = elemBot;
    });

    if (removal.length > 0) {
      $(removal).remove();
      _.extend(this.state, { indexFirst, indexLast });
      _.extend(this.metrics, { itemsTop, itemsHeight });
      this.normalize();
      this.changed = true;
    }
  }

  scrollToAnchor({ index, position }) {
    const { indexFirst, indexLast, itemHeight } = this.state;
    const { visibleTop, visibleBot, listTop } = this.metrics;
    const anchor = {};
    let delta = 0;
    if (indexFirst <= index && index < indexLast) {
      const el = this.listView.$container.children().get(index - indexFirst);
      const rect = el.getBoundingClientRect();

      anchor.index = index;
      if (position === 'top') {
        anchor.top = visibleTop;
      } else if (position === 'bottom') {
        anchor.top = visibleBot - rect.height;
      } else if (position === 'middle') {
        anchor.top = (visibleTop + visibleBot - rect.height) / 2;
      } else if (_.isNumber(position)) {
        anchor.top = visibleTop + position;
      }
      delta = rect.top - anchor.top;
    } else {
      if (position === 'top') {
        anchor.index = index;
        anchor.top = visibleTop;
      } else if (position === 'bottom') {
        anchor.index = index + 1;
        anchor.top = visibleBot;
      } else if (position === 'middle') {
        anchor.index = index;
        anchor.top = (visibleTop + visibleBot - itemHeight) / 2;
      } else if (_.isNumber(position)) {
        anchor.index = index;
        anchor.top = visibleTop + position;
      }
      delta = listTop + index * itemHeight - anchor.top;
    }

    if (Math.abs(delta) > 0.1) {
      _.extend(this.anchor, anchor);
      this.metrics.scrollTop += delta;
      this.metrics.elTop -= delta;
      this.metrics.listTop -= delta;
      this.metrics.itemsTop -= delta;
      this.changed = true;
    }
  }

}
