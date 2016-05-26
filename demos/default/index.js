import $ from 'jquery';
import _ from 'underscore';
import ListView from '../../js/index';
import 'style!css!./index.css';

const listView = window.listView = new ListView({
  items: _.map(_.range(200), () => ({ text: _.random(10000) })),
  // viewport: '.list-container',
}).render();
$('.list-container').append(listView.$el);
