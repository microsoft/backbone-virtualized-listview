import $ from 'jquery';
import { expect } from 'chai';
import ListView from '../js/index.js';
import Backbone from 'backbone';

describe('ListView', function () {
  it('should be a Backbone View', function () {
    expect(ListView.prototype).is.instanceof(Backbone.View);
  });

  describe('with window container', function () {
    beforeEach(function () {
      $('body').append('<h1>Hello</h1>');
    });

    afterEach(function () {
      $('h1').remove();
    });

    it('should be create the header', function () {
      expect($('h1').length).is.at.least(1);
    });
  });
});
