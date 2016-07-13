import { expect } from 'chai';
import ListView from '..';
import Backbone from 'backbone';

describe('backbone-virtualized-listview', function () {
  it('should be a Backbone View', function () {
    expect(ListView.prototype).is.instanceof(Backbone.View);
  });
});
