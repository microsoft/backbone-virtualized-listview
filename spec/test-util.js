import _ from 'underscore';
import Promise from 'bluebird';

export function sleep(timeInterval) {
  return new Promise(_.partial(window.setTimeout, _, timeInterval));
}

export function test(testCase) {
  return function (cb) {
    Promise.resolve(testCase(this)).then(() => cb()).catch(cb);
  };
}
