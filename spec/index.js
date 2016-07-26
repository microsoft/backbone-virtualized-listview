import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';
import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import ListView from '../js/index.js';
import template from './test-container.jade';
import testListTemplate from './test-list.jade';
import { doAsync, sleep } from './test-util.js';

chai.use(sinonChai);

const expect = chai.expect;

const redrawInterval = 100;

describe('ListView', function () {
  let listView = null;

  beforeEach(function () {
    $('body').html(template(this.currentTest));
  });

  afterEach(function () {
    $('body').empty();
  });

  it('should be a Backbone View', function () {
    expect(ListView.prototype).is.instanceof(Backbone.View);
  });

  describe('Properties', function () {
    const count = 20000;

    const model = { title: 'Test Properties' };
    const listTemplate = testListTemplate;
    const itemTemplate = item => `<li>${item.text}</li>`;
    const defaultItemHeight = 18;

    beforeEach(doAsync(async () => {
      listView = new ListView({
        el: '.test-container',
      }).set({
        items: _.map(_.range(count), i => ({ text: i })),
        listTemplate,
        model,
        itemTemplate,
        defaultItemHeight,
      }).render();
      await sleep(redrawInterval);
    }));

    afterEach(doAsync(async () => {
      listView.remove();
      await sleep(redrawInterval);
    }));

    it('should expose the lenght of the list', function () {
      expect(listView.length).to.equal(count);
    });

    it('should be able to get the items', function () {
      expect(listView.itemAt(10)).to.deep.equal({ text: 10 });
    });

    it('should be able to get the elements', function () {
      expect(listView.elementAt(10000)).to.be.null;
      expect(listView.elementAt(1)).to.be.an.instanceof(HTMLElement);
    });

    it('should expose the listTemplate', function () {
      expect(listView.listTemplate).to.equal(listTemplate);
    });

    it('should expose the model', function () {
      expect(listView.model).to.equal(model);
    });

    it('should expose the itemTemplate', function () {
      expect(listView.itemTemplate).to.equal(itemTemplate);
    });

    it('should expose the defaultItemHeight', function () {
      expect(listView.defaultItemHeight).to.equal(defaultItemHeight);
    });
  });

  describe('Handling viewport events', function () {
    const count = 20000;

    beforeEach(doAsync(async () => {
      listView = new ListView({
        el: '.test-container',
      }).set({
        items: _.map(_.range(count), i => ({ text: i })),
      }).render();
      listView.viewport.scrollTo({ y: 0 });
      await sleep(redrawInterval);
    }));

    afterEach(doAsync(async () => {
      listView.remove();
      await sleep(redrawInterval);
    }));

    it('should trigger redraw on viewport change', doAsync(async () => {
      const spy = sinon.spy();

      listView.once('didRedraw', spy);
      listView.viewport.trigger('change');
      expect(spy).not.to.be.called;

      await sleep(150);
      expect(spy).to.be.calledOnce;
    }));

    it('should block redraw for 0.2 second when press a key', doAsync(async () => {
      const spy = sinon.spy();

      listView.once('didRedraw', spy);
      listView.viewport.trigger('keypress');
      listView.viewport.trigger('change');
      expect(spy).not.to.be.called;

      await sleep(150);
      expect(spy).not.to.be.called;

      await sleep(150);
      expect(spy).to.be.calledOnce;
    }));
  });

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
    if (listView.indexLast < listView.options.items.length) {
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

    expect(Math.abs(scrollTop)).to.be.at.most(1);
  }

  function checkScrolledToBottom() {
    const metrics = viewportMetrics();
    const scrollTopMax = metrics.inner.height - metrics.outer.height;
    const scrollTop = metrics.scroll.y;

    expect(scrollTop).to.be.at.least(scrollTopMax - 1);
  }

  function scrollToItem(...args) {
    return new Promise(resolve => listView.scrollToItem(...(args.concat([resolve]))));
  }

  function set(options) {
    return new Promise(resolve => listView.set(options, resolve));
  }

  function getTestCases(viewFactory) {
    return function () {
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
          await scrollToItem(index, 'top');

          checkItemLocation(index, 'top');
          checkViewportFillup();
        }

        await scrollToItem(listView.options.items.length - 1, 'top');

        checkScrolledToBottom();
        checkViewportFillup();
      }));

      it('should be able to scroll an element to bottom', doAsync(async () => {
        for (let index of [11111, 11110, 11100, 11000, 10000]) {
          await scrollToItem(index, 'bottom');

          checkItemLocation(index, 'bottom');
          checkViewportFillup();
        }

        await scrollToItem(0, 'bottom');

        checkScrolledToTop();
        checkViewportFillup();
      }));

      it('should be able to scroll an element to middle', doAsync(async () => {
        for (let index of [11111, 11110, 11100, 11000, 10000]) {
          await scrollToItem(index, 'middle');

          checkItemLocation(index, 'middle');
          checkViewportFillup();
        }

        await scrollToItem(0, 'middle');

        checkScrolledToTop();
        checkViewportFillup();

        await scrollToItem(listView.options.items.length - 1, 'middle');

        checkScrolledToBottom();
        checkViewportFillup();
      }));

      it('should be able to scroll an element to certain offset', doAsync(async () => {
        const index = 1000;
        const height = viewportMetrics().outer.height;

        for (let pos of [0, 0.2, 0.5, 0.7, 0.9].map(rate => rate * height)) {
          await scrollToItem(index, pos);

          checkItemLocation(index, pos);
          checkViewportFillup();
        }
      }));

      it('should be scroll item to nearest visible location with "default" option', doAsync(async () => {
        await scrollToItem(2000);
        checkItemLocation(2000, 'bottom');

        await scrollToItem(2001);
        checkItemLocation(2001, 'bottom');

        await scrollToItem(1000);
        checkItemLocation(1000, 'top');

        await scrollToItem(999);
        checkItemLocation(999, 'top');

        listView.scrollToItem(999);
        await sleep(redrawInterval);
        checkItemLocation(999, 'top');

        const top = getElementRect(1000).top;
        await scrollToItem(1000);
        expect(Math.abs(getElementRect(1000).top - top)).to.be.below(1);
      }));

      it('should complain about wrong position opitons', function () {
        _.each([
          true,
          'some-where',
          { foo: 'bar' },
          ['foo', 'bar'],
        ], pos => {
          expect(() => listView.scrollToItem(0, pos)).to.throw('Invalid position');
        });
      });

      it('should complain about the view is not rendered', function () {
        const view = viewFactory({ size: 20000 });
        const message = 'Cannot scroll before the view is rendered';
        expect(() => view.scrollToItem(10)).to.throw(message);
      });

      it('should be able to reset the defaultItemHeight', doAsync(async () => {
        const height = viewportMetrics().inner.height;
        await set({ defaultItemHeight: 22 });
        expect(viewportMetrics().inner.height).to.be.above(height);
      }));

      it('should be able to reset the items', doAsync(async () => {
        const $ul = $('.test-container > ul');
        const text = 'hello world!';

        await set({ items: [{ text }] });
        expect($ul.children().length).to.equal(1);
        expect($ul.children().text()).to.equal(text);

        await set({ items: [] });
        expect($ul.length).to.equal(1);
        expect($ul.children().length).to.equal(0);
      }));

      it('should be able to use duck typed array as items', doAsync(async () => {
        const $ul = $('.test-container > ul');
        const prefix = 'item';

        await set({
          items: {
            length: 50000,
            slice(start, stop) {
              return _.map(_.range(start, stop), i => ({ text: `${prefix} ${i}` }));
            },
          },
        });
        expect($ul.children().first().text()).to.equal(`${prefix} 0`);
        checkViewportFillup();
      }));

      it('should be able to reset the model and listTemplate', doAsync(async () => {
        const title = 'New Template';
        const model = { title };
        const listTemplate = testListTemplate;

        await set({ model, listTemplate });

        const $h2 = $('.test-container > h2');
        expect($h2.length).to.equal(1);
        expect($h2.text()).to.equal(title);
        checkViewportFillup();
      }));

      it('should be able to reset the itemTemplate', doAsync(async () => {
        const prefix = 'item';
        const itemTemplate = ({ text }) => `<li>${prefix} - ${text}</li>`;

        await set({ itemTemplate });

        const $ul = $('.test-container > ul');
        expect($ul.children().length).to.be.at.least(1);
        expect($ul.children().first().text()).to.be.equal(`${prefix} - ${listView.itemAt(0).text}`);
        checkViewportFillup();
      }));

      it('should be able to handle the DOM events', doAsync(async () => {
        const spy = sinon.spy();
        const events = { 'click li': spy };

        await set({ events });

        const $ul = $('.test-container > ul');
        $ul.children().first().click();
        expect(spy).to.be.calledOnce;
      }));

      it('should be able to handle the ListView events', doAsync(async () => {
        const spyWillRedraw = sinon.spy();
        const spyDidRedraw = sinon.spy();
        const events = { willRedraw: spyWillRedraw, didRedraw: spyDidRedraw };

        await set({ events });
        expect(spyWillRedraw).have.been.calledOnce;
        expect(spyDidRedraw).have.been.calledOnce;

        await scrollToItem(1000);
        expect(spyWillRedraw).have.been.calledTwice;
        expect(spyDidRedraw).have.been.calledTwice;

        await set({ events: {} });
        expect(spyWillRedraw).have.been.calledTwice;
        expect(spyDidRedraw).have.been.calledTwice;

        await scrollToItem(0);
        expect(spyWillRedraw).have.been.calledTwice;
        expect(spyDidRedraw).have.been.calledTwice;
      }));

      it('should invoke the callback immediatedly if reset with no valid options', function () {
        const spy = sinon.spy();

        listView.set({ foo: 'bar' }, spy);
        expect(spy).to.be.calledOnce;
      });

      it('should be able to invalidate the rendered items', doAsync(async () => {
        const $ul = $('.test-container > ul');
        const elFirst = $ul.children().get(0);

        await new Promise(resolve => listView.invalidate(resolve));

        const elFirstNew = $ul.children().get(0);
        expect(elFirstNew).not.to.equal(elFirst);
      }));
    };
  }

  describe('with WindowViewport', getTestCases(({ size }) => new ListView({
    el: '.test-container',
  }).set({
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
    }).set({
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
    }).set({
      items: _.map(_.range(size), i => ({
        text: `${i}: ${_.map(_.range(_.random(50)), () => _.random(9)).join('')}`,
      })),
    });
  }));

  describe('Non-virtualized list view', function () {
    const count = 500;

    beforeEach(function (done) {
      listView = new ListView({
        el: '.test-container',
        virtualized: false,
      }).set({
        items: _.map(_.range(count), i => ({ text: i })),
      });
      listView.render(done);
    });

    afterEach(doAsync(async () => {
      listView.remove();
      await sleep(redrawInterval);
    }));

    async function checkDOMUnchanged(action) {
      const $ul = $('.test-container > ul');
      const elFirst = $ul.children().first().get(0);
      const elLast = $ul.children().last().get(0);

      await action(function () {
        const $ulNew = $('.test-container > ul');
        const elFirstNew = $ulNew.children().get(0);
        const elLastNew = $ulNew.children().last().get(0);

        expect($ulNew.get(0)).to.equal($ul.get(0));
        expect(elFirstNew).to.equal(elFirst);
        expect(elLastNew).to.equal(elLast);
      });
    }

    it('should render all items initially', function () {
      const $ul = $('.test-container > ul');

      expect($ul.children().length).to.equal(count);
      expect($ul.children().first().text()).to.equal('0');
    });

    it('should keep the DOM unchanged after scrolling', doAsync(
      async () => checkDOMUnchanged(async verify => {
        for (let scrollTop of [100, 1000, 5000, 3000]) {
          listView.viewport.scrollTo({ y: scrollTop });
          await sleep(redrawInterval);
          verify();
        }

        for (let scrollTop = 1000; scrollTop < 1500; scrollTop += 100) {
          listView.viewport.scrollTo({ y: scrollTop });
          await sleep(redrawInterval);
          verify();
        }

        for (let scrollTop = 2000; scrollTop > 1500; scrollTop -= 100) {
          listView.viewport.scrollTo({ y: scrollTop });
          await sleep(redrawInterval);
          verify();
        }
      })
    ));

    it('should keep the DOM unchanged after scrolling to item', doAsync(
      async () => checkDOMUnchanged(async verify => {
        for (let index of [0, 1, 11, 111]) {
          await scrollToItem(index, 'top');
          verify();
          checkItemLocation(index, 'top');
        }

        for (let index of [111, 110, 100]) {
          await scrollToItem(index, 'bottom');
          verify();
          checkItemLocation(index, 'bottom');
        }

        for (let index of [111, 110, 100]) {
          await scrollToItem(index, 'middle');
          verify();
          checkItemLocation(index, 'middle');
        }

        await scrollToItem(0, 'bottom');
        verify();
        checkScrolledToTop();

        await scrollToItem(listView.length - 1, 'top');
        verify();
        checkScrolledToBottom();

        await scrollToItem(0, 'middle');
        verify();
        checkScrolledToTop();

        await scrollToItem(listView.length - 1, 'middle');
        verify();
        checkScrolledToBottom();
      })
    ));
  });
});
