import $ from 'jquery';
import _ from 'underscore';
import { WindowViewport, ElementViewport } from '../../js/viewport.js';
import { Mark } from './mark.js';
import './index.less';

const vpWindow = new WindowViewport();
const vpElement = new ElementViewport(document.getElementById('outer'));
const marks = _.map(_.range(4), () => new Mark().render());

_.each(marks, mark => document.body.appendChild(mark.el));

function update() {
  const innerEl = vpElement.getMetrics().inner;
  const windowWidth = window.innerWidth;
  const windowHeight = window.innerHeight;

  marks[0].model.set({ x: innerEl.left, y: innerEl.top, windowWidth, windowHeight });
  marks[1].model.set({ x: innerEl.left, y: innerEl.bottom, windowWidth, windowHeight });
  marks[2].model.set({ x: innerEl.right, y: innerEl.top, windowWidth, windowHeight });
  marks[3].model.set({ x: innerEl.right, y: innerEl.bottom, windowWidth, windowHeight });

  const innerWin = vpWindow.getMetrics().inner;
  const posWin = _.chain([
    'left',
    'top',
    'right',
    'bottom',
    'width',
    'height',
  ]).map(key => `${key}: ${innerWin[key]}`).join('; ').value();
  $('#window-position').text(posWin);
}

update();

vpWindow.on('change', update);
vpElement.on('change', update);
