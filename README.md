# cerebral-module-devtools
Module to enable Google Chrome debugger extension for Cerebral application

[![NPM version][npm-image]][npm-url]
[![Build status][travis-image]][travis-url]
[![Test coverage][coveralls-image]][coveralls-url]
[![bitHound Score][bithound-image]][bithound-url]
[![Commitizen friendly][commitizen-image]][commitizen-url]
[![Semantic Release][semantic-release-image]][semantic-release-url]
[![js-standard-style][standard-image]][standard-url]
[![Discord][discord-image]][discord-url]

### Install

`npm install cerebral-module-devtools`

### How to use

```js
import Cerebral from 'cerebral';
import Model from 'cerebral-model-baobab'
import Devtools from 'cerebral-module-devtools';
import App from './modules/app';

var controller = Controller(Model({}))

controller.addModules({
  devtools: Devtools()
  app: App
})
```

[npm-image]: https://img.shields.io/npm/v/cerebral-module-devtools.svg?style=flat
[npm-url]: https://npmjs.org/package/cerebral-module-devtools
[travis-image]: https://img.shields.io/travis/cerebral/cerebral-module-devtools.svg?style=flat
[travis-url]: https://travis-ci.org/cerebral/cerebral-module-devtools
[coveralls-image]: https://img.shields.io/coveralls/cerebral/cerebral-module-devtools.svg?style=flat
[coveralls-url]: https://coveralls.io/r/cerebral/cerebral-module-devtools?branch=master
[bithound-image]: https://www.bithound.io/github/cerebral/cerebral-module-devtools/badges/score.svg
[bithound-url]: https://www.bithound.io/github/cerebral/cerebral-module-devtools
[commitizen-image]: https://img.shields.io/badge/commitizen-friendly-brightgreen.svg
[commitizen-url]: http://commitizen.github.io/cz-cli/
[semantic-release-image]: https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg?style=flat-square
[semantic-release-url]: https://github.com/semantic-release/semantic-release
[standard-image]: https://img.shields.io/badge/code%20style-standard-brightgreen.svg
[standard-url]: http://standardjs.com/
[discord-image]: https://img.shields.io/badge/discord-join%20chat-blue.svg
[discord-url]: https://discord.gg/0kIweV4bd2bwwsvH
