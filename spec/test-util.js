import Promise from 'bluebird';

export function sleep(timeInterval) {
  return new Promise(resolve => {
    window.setTimeout(() => resolve(), timeInterval);
  });
}

export function doAsync(fn) {
  return async function (done) {
    try {
      await fn(this);
      done();
    } catch (err) {
      done(err);
    }
  };
}
