import _ from 'underscore';
import $ from 'jquery';
import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { Viewport } from '../js/viewport.js';
import { doAsync, sleep } from './test-util.js';

chai.use(sinonChai);

const expect = chai.expect;

describe('Viewport', function () {
  let viewport = null;
  beforeEach(function () {
    viewport = new Viewport($(window));
  });

  describe('onScroll', function () {
    it('should trigger the change event', function () {
      let spy = sinon.spy();

      viewport.on('change', spy);
      viewport.onScroll();
      expect(spy).to.be.calledOnce;
    });

    it('should trigger the scroll event', function () {
      let spy = sinon.spy();

      viewport.on('scroll', spy);
      viewport.onScroll();
      expect(spy).to.be.calledOnce;
    });
  });

  describe('onResize', function () {
    it('should trigger the change event', function () {
      let spy = sinon.spy();

      viewport.on('change', spy);
      viewport.onResize();
      expect(spy).to.be.calledOnce;
    });

    it('should trigger the resize event', function () {
      let spy = sinon.spy();

      viewport.on('resize', spy);
      viewport.onResize();
      expect(spy).to.be.calledOnce;
    });
  });

  describe('key event handlers', function () {
    it('should trigger key press on keydown', function () {
      let spy = sinon.spy();

      viewport.on('keypress', spy);
      viewport.onKeydown({ keyCode: 36 });
      expect(spy).to.be.calledOnce;
    });

    it('should consolidate the dead keys', function () {
      let spy = sinon.spy();

      viewport.on('keypress', spy);
      _.times(10, () => viewport.onKeydown({ keyCode: 36 }));
      expect(spy).to.be.calledOnce;
    });

    it('should respect the keyup when detecting dead keys', function () {
      let spy = sinon.spy();

      viewport.on('keypress', spy);
      _.times(10, () => {
        viewport.onKeydown({ keyCode: 36 });
        viewport.onKeyup();
      });
      expect(spy).to.have.callCount(10);
    });

    it('should release the dead key after a 0.2 second interval', doAsync(async () => {
      let spy = sinon.spy();

      viewport.on('keypress', spy);
      viewport.onKeydown({ keyCode: 36 });

      await sleep(250);

      viewport.onKeydown({ keyCode: 36 });
      expect(spy).to.be.calledTwice;
    }));

    it('should treat different keys as separated events', function () {
      let spy = sinon.spy();

      viewport.on('keypress', spy);
      _.each(_.range(10), i => viewport.onKeydown({ keyCode: 36 + i }));
      expect(spy).to.have.callCount(10);
    });
  });

  describe('getMetrics', function () {
    it('should complain about "not implemented"', function () {
      expect(() => viewport.getMetrics()).to.throw('Not implemented');
    });
  });

  describe('scrollTo', function () {
    it('should try to set the scrollTop and scrollLeft of $el', function () {
      const left = 10;
      const top = 20;
      const spyLeft = viewport.$el.scrollLeft = sinon.spy();
      const spyTop = viewport.$el.scrollTop = sinon.spy();

      viewport.scrollTo({ x: left, y: top });
      expect(spyLeft).to.be.calledWith(left);
      expect(spyTop).to.be.calledWith(top);
    });
  });
});

