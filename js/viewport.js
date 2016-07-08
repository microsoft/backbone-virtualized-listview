import Backbone from 'backbone';
import $ from 'jquery';
import _ from 'underscore';

function getElementMetrics(el) {
  return _.pick(el.getBoundingClientRect(), [
    'left',
    'top',
    'right',
    'bottom',
    'width',
    'height',
  ]);
}

class Viewport {
  constructor($el) {
    _.extend(this, Backbone.Events);

    this.$el = $el;

    let scroll = null;

    this.onScroll = () => {
      scroll = null;
      this.trigger('scroll');
      this.trigger('change');
    };

    this.onResize = () => {
      scroll = null;
      this.trigger('resize');
      this.trigger('change');
    };

    this.$el.on('resize', this.onResize);
    this.$el.on('scroll', this.onScroll);

    this.scrollTo = scrollNew => {
      if (!scroll) {
        window.setTimeout(() => {
          if (scroll) {
            if (_.isNumber(scroll.x)) {
              this.$el.scrollLeft(scroll.x);
            }
            if (_.isNumber(scroll.y)) {
              this.$el.scrollTop(scroll.y);
            }
            scroll = null;
          }
        }, 0.1);
      }
      scroll = scrollNew;
    };
  }

  remove() {
    this.$el.off('resize', this.onResize);
    this.$el.off('scroll', this.onScroll);
  }

  getMetrics() {
    throw new Error('Not implemented');
  }
}

export class WindowViewport extends Viewport {
  constructor() {
    super($(window));
  }

  getMetrics() {
    const inner = getElementMetrics(document.documentElement);

    inner.width = document.documentElement.scrollWidth;
    inner.height = document.documentElement.scrollHeight;
    inner.right = inner.left + inner.width;
    inner.bottom = inner.top + inner.height;

    return {
      inner,
      outer: {
        top: 0,
        bottom: window.innerHeight,
        left: 0,
        right: window.innerWidth,
        width: window.innerWidth,
        height: window.innerHeight,
      },
      scroll: {
        x: window.scrollX,
        y: window.scrollY,
      },
    };
  }
}

export class ElementViewport extends Viewport {
  constructor(el) {
    super($(el));

    this.el = this.$el.get(0);
    this.el.style.overflow = 'auto';
  }

  getMetrics() {
    const outer = getElementMetrics(this.el);
    const scroll = {
      x: this.el.scrollLeft,
      y: this.el.scrollTop,
    };
    const inner = {
      left: outer.left - scroll.x,
      top: outer.top - scroll.y,
      width: this.el.scrollWidth,
      height: this.el.scrollHeight,
    };
    inner.right = inner.left + inner.width;
    inner.bottom = inner.top + inner.height;

    return { outer, inner, scroll };
  }

}
