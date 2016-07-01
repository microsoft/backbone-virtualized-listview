import { WindowViewport, ElementViewport } from '../../js/viewport.js';

const vpWindow = new WindowViewport();
const vpElement = new ElementViewport(document.getElementById('container'));

document.getElementById('btn-measure-window').onclick = () => {
  console.log(JSON.stringify(vpWindow.getMetrics(), null, 2));
};

document.getElementById('btn-measure-element').onclick = () => {
  console.log(JSON.stringify(vpElement.getMetrics(), null, 2));
};
