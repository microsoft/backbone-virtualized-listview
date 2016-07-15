import $ from 'jquery';
import chai from 'chai';
import { Viewport } from '../js/viewport.js';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

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

