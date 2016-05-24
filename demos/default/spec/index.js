var expect = require('chai').expect;

/* global browser */
/* eslint no-unused-expressions: 0 */
describe('webdriver.io page', function () {
  it('should render the head line correctly', function () {
    var headLine = browser.element('h1');
    expect(headLine).to.be.exist;
  });
});
