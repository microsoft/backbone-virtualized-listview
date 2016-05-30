import $ from 'jquery';
import _ from 'underscore';
import ListView from '../../js/index';
import 'style!css!./index.css';

const listView = window.listView = new ListView({
  // items: _.map(_.range(20000), () => ({ text: _.random(10000) })),
  items: _.map(_.range(20000), i => ({ text: i })),
  viewport: '.list-container',
}).render();
$('.list-container').append(listView.$el);
