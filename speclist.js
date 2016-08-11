require('babel-polyfill');
var testsContext = require.context('./spec', true, /\.js$/);
testsContext.keys().forEach(testsContext);

//require('./spec/viewport-detection.js');
//require('./spec/index.js');
