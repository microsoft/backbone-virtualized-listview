import $ from 'jquery';
import chai from 'chai';
import ListView from '../js/index.js';
import elementViewportTemplate from './viewport-detection-element.jade';
import windowViewportTemplate from './viewport-detection-window.jade';
import listTemplate from './initial-list.jade';
import { doAsync } from './test-util.js';
import { WindowViewport, ElementViewport } from '../js/viewport.js';

const expect = chai.expect;

describe('ListView', function () {
  let listView = null;

  afterEach(function () {
    if (listView) {
      listView.remove();
    }
    $('body').empty();
  });

  describe('viewport detection', function () {
    it('should use a WindowViewport when giving a window', doAsync(async () => {
      $('body').html(elementViewportTemplate());

      listView = new ListView({
        el: '.test-container',
        viewport: window,
      }).set({ items: [] });

      await new Promise(resolve => listView.render(resolve));

      expect(listView.viewport).to.be.instanceof(WindowViewport);
    }));

    it('should use the ElementViewport when giving the jQuery object', doAsync(async () => {
      $('body').html(elementViewportTemplate());

      listView = new ListView({
        el: '.test-container',
        viewport: $('.viewport-raw'),
      }).set({ items: [] });

      await new Promise(resolve => listView.render(resolve));

      expect(listView.viewport).to.be.instanceof(ElementViewport);
      expect(listView.viewport.el).to.equal($('.viewport-raw').get(0));
      expect(listView.viewport.$el.css('overflow')).to.equal('auto');
    }));

    it('should use the ElementViewport when giving the DOM element', doAsync(async () => {
      $('body').html(elementViewportTemplate());

      listView = new ListView({
        el: '.test-container',
        viewport: $('.viewport-raw').get(0),
      }).set({ items: [] });

      await new Promise(resolve => listView.render(resolve));

      expect(listView.viewport).to.be.instanceof(ElementViewport);
      expect(listView.viewport.el).to.equal($('.viewport-raw').get(0));
      expect(listView.viewport.$el.css('overflow')).to.equal('auto');
    }));

    it('should use the ElementViewport with the inner element when giving a selector', doAsync(async () => {
      $('body').html(elementViewportTemplate());

      listView = new ListView({
        el: '.test-container',
        viewport: '.internal-viewport',
      }).set({
        items: [],
        listTemplate,
      });

      await new Promise(resolve => listView.render(resolve));

      expect(listView.viewport).to.be.instanceof(ElementViewport);
      expect(listView.viewport.el).to.equal(listView.$('.internal-viewport').get(0));
      expect(listView.viewport.$el.css('overflow')).to.equal('auto');
    }));

    it('should detect the nearest ElementViewport when not specified', doAsync(async () => {
      $('body').html(elementViewportTemplate());

      listView = new ListView({
        el: '.test-container',
      }).set({ items: [] });

      await new Promise(resolve => listView.render(resolve));

      expect(listView.viewport).to.be.instanceof(ElementViewport);
      expect(listView.viewport.el).to.equal($('.viewport-inner').get(0));
    }));

    it('should use a WindowViewport if no element viewport detected', doAsync(async () => {
      $('body').html(windowViewportTemplate());

      listView = new ListView({
        el: '.test-container',
      }).set({ items: [] });

      await new Promise(resolve => listView.render(resolve));

      expect(listView.viewport).to.be.instanceof(WindowViewport);
    }));
  });
});
