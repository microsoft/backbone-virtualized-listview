import $ from 'jquery';
import _ from 'underscore';
import ListView from '../../js/index';
import 'style!css!./index.css';

const listView = window.listView = new ListView({
  items: _.map(_.range(2000), i => ({ text: i })),
  virtualized: false,
}).render();
$('.container').append(listView.$el);
