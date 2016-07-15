# [backbone-virtualized-listview][git-repo]
  [![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Dependency Status][daviddm-image]][daviddm-url] [![Coverage percentage][coveralls-image]][coveralls-url]

Backbone list view with virtualization support

## Install
```bash
# install the module
npm install --save backbone-virtualized-listview
# install the peer dependencies
npm install --save jquery underscore backbone fast-binary-indexed-tree
```

## Usage
```javascript
import _ from 'underscore';
import ListView from 'backbone-virtualized-listview';

const listView = new ListView({
  el: '.container',
  items: _.map(_.range(2000), i => { text: i }),
});
listView.render();
```

[git-repo]: https://github.com/Microsoft/backbone-virtualized-listview
[npm-image]: https://badge.fury.io/js/backbone-virtualized-listview.svg
[npm-url]: https://npmjs.org/package/backbone-virtualized-listview
[travis-image]: https://travis-ci.org/Microsoft/backbone-virtualized-listview.svg?branch=master
[travis-url]: https://travis-ci.org/Microsoft/backbone-virtualized-listview
[daviddm-image]: https://david-dm.org/Microsoft/backbone-virtualized-listview.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/Microsoft/backbone-virtualized-listview
[coveralls-image]: https://coveralls.io/repos/Microsoft/backbone-virtualized-listview/badge.svg
[coveralls-url]: https://coveralls.io/r/Microsoft/backbone-virtualized-listview
