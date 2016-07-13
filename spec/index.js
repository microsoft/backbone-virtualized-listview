import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';
import Promise from 'bluebird';
import { expect } from 'chai';
import ListView from '../js/index.js';
import template from './test-container.jade';

const wait = t => new Promise((resolve, reject) => window.setTimeout(resolve), t);

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

  describe('with window container', function () {
    let listView = null;

    beforeEach(function () {
      listView = new ListView({
        el: '.test-container',
        items: _.map(_.range(20000), i => ({ text: i })),
      }).render();
    });

    it('should create the ListView correctly', function (cb) {
      expect($('.test-container').get(0)).to.equal(listView.el);
      wait(50).then(() => {
        expect($('.test-container').find('li').length).to.be.above(0);
      }).then(() => cb()).catch(cb);
    });
  });
});
