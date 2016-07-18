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

export class Viewport {
  constructor($el) {
    _.extend(this, Backbone.Events);

    this.$el = $el;

    this.onScroll = () => {
      this.trigger('scroll');
      this.trigger('change');
    };

    this.onResize = () => {
      this.trigger('resize');
      this.trigger('change');
    };

    let keyCode = null;
    let timestamp = performance.now();
    this.onKeydown = event => {
      // Consolidate the keydown events for the same key in 0.2 seconds
      if (keyCode !== event.keyCode || performance.now() > timestamp + 200) {
        keyCode = event.keyCode;
        timestamp = performance.now();
        this.trigger('keypress', keyCode);
      }
    };

    this.onKeyup = () => {
      keyCode = null;
    };

    this.$el.on('resize', this.onResize);
    this.$el.on('scroll', this.onScroll);
    $(document).on('keydown', this.onKeydown);
    $(document).on('keyup', this.onKeyup);

    this.scrollTo = scrollNew => {
      if (_.isNumber(scrollNew.x)) {
        this.$el.scrollLeft(scrollNew.x);
      }
      if (_.isNumber(scrollNew.y)) {
        this.$el.scrollTop(scrollNew.y);
      }
    };
  }

  remove() {
    this.$el.off('resize', this.onResize);
    this.$el.off('scroll', this.onScroll);
    $(document).off('keydown', this.onKeydown);
    $(document).off('keyup', this.onKeyup);
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

    const outer = {
      top: 0,
      bottom: window.innerHeight,
      left: 0,
      right: window.innerWidth,
      width: window.innerWidth,
      height: window.innerHeight,
    };

    const scroll = {
      x: window.scrollX,
      y: window.scrollY,
    };

    scroll.ratioX = scroll.x > 0 ? scroll.x / (inner.width - outer.width) : 0;
    scroll.ratioY = scroll.y > 0 ? scroll.y / (inner.height - outer.height) : 0;

    return { inner, outer, scroll };
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

    scroll.ratioX = scroll.x > 0 ? scroll.x / (inner.width - outer.width) : 0;
    scroll.ratioY = scroll.y > 0 ? scroll.y / (inner.height - outer.height) : 0;

    return { outer, inner, scroll };
  }

}
