import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';
import { expect } from 'chai';
import ListView from '../js/index.js';
import template from './test-container.jade';
import { doAsync, sleep } from './test-util.js';

const redrawInterval = 100;

describe('ListView', function () {
  beforeEach(function () {
    $('body').html(template(this.currentTest));
  });

  afterEach(function () {
    $('body').empty();
  });

  it('should be a Backbone View', function () {
    expect(ListView.prototype).is.instanceof(Backbone.View);
  });

  function getTestCases(viewFactory) {
    return function () {
      let listView = null;

      beforeEach(doAsync(async () => {
        listView = viewFactory({ size: 20000 });
        listView.render();
        listView.viewport.scrollTo({ y: 0 });
        await sleep(redrawInterval);
      }));

      afterEach(doAsync(async () => {
        listView.remove();
        await sleep(redrawInterval);
      }));

      function viewportMetrics() {
        return listView.viewport.getMetrics();
      }

      function checkViewportFillup() {
        const items = $('.test-container > ul > li');
        const [rectFirst, rectLast] = [
          items.first(),
          items.last(),
        ].map($el => $el.get(0).getBoundingClientRect());
        const { top, bottom } = viewportMetrics().outer;

        if (listView.indexFirst > 0) {
          expect(rectFirst.top).to.be.at.most(top);
        }
        if (listView.indexLast < listView.items.length) {
          expect(rectLast.bottom).to.be.at.least(bottom);
        }

        return null;
      }

      function getElementRect(index) {
        expect(index).to.be.at.least(listView.indexFirst);
        expect(index).to.be.below(listView.indexLast);

        const el = $('.test-container > ul > li').get(index - listView.indexFirst);
        return el.getBoundingClientRect();
      }

      function checkItemLocation(index, position) {
        const rect = getElementRect(index);
        const { top, bottom } = viewportMetrics().outer;
        const middle = (top + bottom) / 2;

        if (position === 'top') {
          expect(Math.abs(rect.top - top)).to.be.below(1);
        } else if (position === 'bottom') {
          expect(Math.abs(rect.bottom - bottom)).to.be.below(1);
        } else if (position === 'middle') {
          const elMiddle = (rect.top + rect.bottom) / 2;
          expect(Math.abs(elMiddle - middle)).to.be.below(1);
        } else if (_.isNumber(position)) {
          expect(Math.abs(rect.top - (top + position))).to.be.below(1);
        }
      }

      function checkScrolledToTop() {
        const scrollTop = listView.viewport.getMetrics().scroll.y;

        expect(Math.abs(scrollTop)).to.be.below(1);
      }

      function checkScrolledToBottom() {
        const metrics = viewportMetrics();
        const scrollTopMax = metrics.inner.height - metrics.outer.height;
        const scrollTop = metrics.scroll.y;

        expect(scrollTop).to.be.above(scrollTopMax - 1);
      }

      it('should create the ListView correctly', function () {
        expect($('.test-container').get(0)).to.equal(listView.el);
        expect($('.test-container > ul > li').length).to.be.above(0);
      });

      it('should fill up the viewport', function () {
        const elLast = $('.test-container > ul > li').last().get(0);
        const rectLast = elLast.getBoundingClientRect();
        const height = viewportMetrics().outer.height;

        expect(rectLast.bottom).to.be.at.least(height);
      });

      it('should fill up the viewport after jump scrolling', doAsync(async () => {
        for (let scrollTop of [1000, 2000, 20000, 10000]) {
          listView.viewport.scrollTo({ y: scrollTop });
          await sleep(redrawInterval);

          checkViewportFillup();
        }
      }));

      it('should fill up the viewport while scrolling down continuously', doAsync(async () => {
        for (let scrollTop = 1000; scrollTop < 1500; scrollTop += 100) {
          listView.viewport.scrollTo({ y: scrollTop });
          await sleep(redrawInterval);

          checkViewportFillup();
        }
      }));

      it('should fill up the viewport while scrolling up continuously', doAsync(async () => {
        for (let scrollTop = 2000; scrollTop > 1500; scrollTop -= 100) {
          listView.viewport.scrollTo({ y: scrollTop });
          await sleep(redrawInterval);

          checkViewportFillup();
        }
      }));

      it('should be able to scroll an element to top', doAsync(async () => {
        for (let index of [0, 1, 11, 111, 1111, 11111]) {
          listView.scrollToItem(index, 'top');
          await sleep(redrawInterval);

          checkItemLocation(index, 'top');
          checkViewportFillup();
        }

        listView.scrollToItem(listView.items.length - 1, 'top');
        await sleep(redrawInterval);

        checkScrolledToBottom();
        checkViewportFillup();
      }));

      it('should be able to scroll an element to bottom', doAsync(async () => {
        for (let index of [11111, 11110, 11100, 11000, 10000]) {
          listView.scrollToItem(index, 'bottom');
          await sleep(redrawInterval);

          checkItemLocation(index, 'bottom');
          checkViewportFillup();
        }

        listView.scrollToItem(0, 'bottom');
        await sleep(redrawInterval);

        checkScrolledToTop();
        checkViewportFillup();
      }));

      it('should be able to scroll an element to middle', doAsync(async () => {
        for (let index of [11111, 11110, 11100, 11000, 10000]) {
          listView.scrollToItem(index, 'middle');
          await sleep(redrawInterval);

          checkItemLocation(index, 'middle');
          checkViewportFillup();
        }

        listView.scrollToItem(0, 'middle');
        await sleep(redrawInterval);

        checkScrolledToTop();
        checkViewportFillup();

        listView.scrollToItem(listView.items.length - 1, 'middle');
        await sleep(redrawInterval);

        checkScrolledToBottom();
        checkViewportFillup();
      }));

      it('should be able to scroll an element to certain offset', doAsync(async () => {
        const index = 1000;
        const height = viewportMetrics().outer.height;

        for (let pos of [0, 0.2, 0.5, 0.7, 0.9].map(rate => rate * height)) {
          listView.scrollToItem(index, pos);
          await sleep(redrawInterval);

          checkItemLocation(index, pos);
          checkViewportFillup();
        }
      }));

      it('should be scroll item to nearest visible location with "default" option', doAsync(async () => {
        listView.scrollToItem(2000);
        await sleep(redrawInterval);

        checkItemLocation(2000, 'bottom');

        listView.scrollToItem(2001);
        await sleep(redrawInterval);

        checkItemLocation(2001, 'bottom');

        listView.scrollToItem(1000);
        await sleep(redrawInterval);

        checkItemLocation(1000, 'top');

        listView.scrollToItem(999);
        await sleep(redrawInterval);

        checkItemLocation(999, 'top');

        listView.scrollToItem(999);
        await sleep(redrawInterval);

        checkItemLocation(999, 'top');

        const { top } = getElementRect(1000);
        listView.scrollToItem(1000);
        await sleep(redrawInterval);

        expect(Math.abs(getElementRect(1000).top - top)).to.be.below(1);
      }));

      it('should complain about wrong position opitons', function () {
        _.each([
          true,
          'some-where',
          { foo: 'bar' },
          ['foo', 'bar'],
          _.noop,
        ], pos => {
          expect(() => listView.scrollToItem(0, pos)).to.throw('Invalid position');
        });
      });

      it('should be able to reset the items', doAsync(async () => {
        listView.reset({
          items: [],
        });
        await sleep(redrawInterval);

        const $ul = $('.test-container > ul');
        expect($ul.length).to.equal(1);
        expect($ul.children().length).to.equal(0);

        const text = 'hello world!';
        listView.setItems([{ text }]);
        await sleep(redrawInterval);

        expect($ul.children().length).to.equal(1);
        expect($ul.children().text()).to.equal(text);
      }));
    };
  }

  describe('with WindowViewport', getTestCases(({ size }) => new ListView({
    el: '.test-container',
    items: _.map(_.range(size), i => ({ text: i })),
  })));

  describe('with ElementViewport', getTestCases(({ size }) => {
    $('.test-container').css({
      height: 600,
      width: 400,
    });
    return new ListView({
      el: '.test-container',
      viewport: '.test-container',
      items: _.map(_.range(size), i => ({ text: i })),
    });
  }));

  describe('with variant height items', getTestCases(({ size }) => {
    $('.test-container').css({
      height: 500,
      width: 200,
    });
    return new ListView({
      el: '.test-container',
      viewport: '.test-container',
      items: _.map(_.range(size), i => ({
        text: `${i}: ${_.map(_.range(_.random(50)), () => _.random(9)).join('')}`,
      })),
    });
  }));
});
