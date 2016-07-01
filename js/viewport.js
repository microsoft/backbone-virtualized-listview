import $ from 'jquery';
import _ from 'underscore';

function getElementMetrics(el) {
  return _.pick(el.getBoundingClientRect(), ['left', 'top', 'right', 'bottom', 'width', 'height']);
}

class Viewport {
  getMetrics() {
    return {
      inner: this.getInnerMetrics(),
      outer: this.getOuterMetrics(),
      scroll: this.getScrollMetrics(),
    };
  }

  getInnerMetrics() {
    throw new Error('Not implemented');
  }

  getOuterMetrics() {
    throw new Error('Not implemented');
  }

  getScrollMetrics() {
    throw new Error('Not implemented');
  }
}

export class WindowViewport extends Viewport {
  getInnerMetrics() {
    return getElementMetrics(document.documentElement);
  }

  getOuterMetrics() {
    return {
      top: 0,
      bottom: window.innerHeight,
      left: 0,
      right: window.innerWidth,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  getScrollMetrics() {
    return {
      x: window.scrollX,
      y: window.scrollY,
    };
  }
}

export class ElementViewport extends Viewport {
  constructor(el) {
    super();

    this.el = el;
    this.el.style.overflow = 'scroll';
  }

  getInnerMetrics() {
    const left = this.el.scrollLeft;
    const top = this.el.scrollTop;
    const width = this.el.scrollWidth;
    const height = this.el.scrollHeight;

    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height,
    };
  }

  getOuterMetrics() {
    return getElementMetrics(this.el);
  }

  getScrollMetrics() {
    return {
      x: this.el.scrollLeft,
      y: this.el.scrollTop,
    };
  }
}

