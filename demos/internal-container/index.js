import _ from 'underscore';
import listTemplate from './list.jade';
import ListView from '../../js/index';
import 'style!css!./index.css';

window.listView = new ListView({
  el: '.container',
  viewport: '.viewport',
}).set({
  model: { title: 'Internal Viewport' },
  items: _.map(_.range(200000), i => ({ text: i })),
  defaultItemHeight: 40,
  listTemplate,
}).render();

