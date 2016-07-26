# [backbone-virtualized-listview][git-repo]
  [![NPM version][npm-image]][npm-url]
  [![Build Status][travis-image]][travis-url]
  [![Dependency Status][daviddm-image]][daviddm-url]
  [![Coverage percentage][coveralls-image]][coveralls-url]
> Backbone list view with virtualization support

UI virtualization is essential to your Web UI performance in case you have
thousands of data item to render. *The idea is to skip rendering the off screen
items and replace them with filler blocks. You need to handle the scroll and
resize events to adjust the DOM content.*

The principle is straight forward, but the implementation is fussy. This
[Backbone][backbonejs] based implementation is aiming to create a general
purposed virtualized view with high quality and performance, so that people can
focus more on the user experience instead of the complexity of virtualization.

## Features

### Customization
The `ListView` is named as "list view", but it's not necessarily to render a
list. You can customize it into a `TABLE`, or a sequence of `DIV`s with the
`listTemplate` and the `itemTemplate` options.

Refer to the [document][docs-list-view] for detail

### Scroll to item
You can scroll a certain item into the viewport, method `scrollToItem` is
the helper.

Refer to the [document][docs-scroll-to-item] for detail.

### Handling data change
When data is changed, you can update the view with the `set` method.

Refer to the [document][docs-set] for detail.

## Installation
```bash
# install the module
npm install --save backbone-virtualized-listview
# install the peer dependencies
npm install --save jquery underscore backbone fast-binary-indexed-tree
```

## Usage

Refer to the [document][docs] for details.

```javascript
import _ from 'underscore';
import ListView from 'backbone-virtualized-listview';
import listTemplate from 'my-list-template.jade';
import itemTemplate from 'my-item-template.jade';

const listView = new ListView({
  el: '.container',
}).set({
  items: _.map(_.range(2000), i => { text: i }),
  listTemplate,
  itemTemplate,
});
listView.render();

// Scroll to item
listView.scrollToItem(100);
```

## License

MIT

This project has adopted the [Microsoft Open Source Code of Conduct][ms-code-of-conduct].
For more information see the [Code of Conduct FAQ][ms-code-of-conduct-faq]
or contact [opencode@microsoft.com][ms-mailto] with any additional questions or comments.

[backbonejs]: http://backbonejs.org/
[docs]: https://microsoft.github.io/backbone-virtualized-listview/
[docs-list-view]: https://microsoft.github.io/backbone-virtualized-listview/ListView.html
[docs-scroll-to-item]: https://microsoft.github.io/backbone-virtualized-listview/ListView.html#scrollToItem__anchor
[docs-set]: https://microsoft.github.io/backbone-virtualized-listview/ListView.html#set__anchor

[ms-code-of-conduct]: https://opensource.microsoft.com/codeofconduct/
[ms-code-of-conduct-faq]: https://opensource.microsoft.com/codeofconduct/faq/
[ms-mailto]: mailto:opencode@microsoft.com

[git-repo]: https://github.com/Microsoft/backbone-virtualized-listview
[npm-image]: https://badge.fury.io/js/backbone-virtualized-listview.svg
[npm-url]: https://npmjs.org/package/backbone-virtualized-listview
[travis-image]: https://travis-ci.org/Microsoft/backbone-virtualized-listview.svg?branch=master
[travis-url]: https://travis-ci.org/Microsoft/backbone-virtualized-listview
[daviddm-image]: https://david-dm.org/Microsoft/backbone-virtualized-listview.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/Microsoft/backbone-virtualized-listview
[coveralls-image]: https://coveralls.io/repos/Microsoft/backbone-virtualized-listview/badge.svg
[coveralls-url]: https://coveralls.io/r/Microsoft/backbone-virtualized-listview
