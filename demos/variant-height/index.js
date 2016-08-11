import _ from 'underscore';
import ListView from '../../js/index';
import 'style!css!./index.css';

window.listView = new ListView({ el: '.container' }).set({
  items: _.map(_.range(20000), i => ({
    text: `${i}: ${_.map(_.range(_.random(50)), () => _.random(9)).join('')}`,
  })),
}).render();

