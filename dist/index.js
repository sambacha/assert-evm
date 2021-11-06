
'use strict'

if (process.env.NODE_ENV === 'production') {
  module.exports = require('./assert-evm.cjs.production.min.js')
} else {
  module.exports = require('./assert-evm.cjs.development.js')
}
