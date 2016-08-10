import $ from 'jquery';
import _ from 'underscore';
import ListView from '../../js/index';
import 'style!css!./index.css';

window._ = _;

const listView = window.listView = new ListView({
  viewport: '.container',
}).set({
  items: _.map(_.range(200000), i => ({ text: i })),
  defaultItemHeight: 40,
}).render();
$('.container').append(listView.$el);
