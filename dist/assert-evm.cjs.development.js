'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var ethers = require('ethers');

function supportBigNumber(Assertion, utils) {
  Assertion.overwriteMethod('equal', override('eq', 'equal', utils));
  Assertion.overwriteMethod('eq', override('eq', 'equal', utils));
  Assertion.overwriteMethod('above', override('gt', 'above', utils));
  Assertion.overwriteMethod('gt', override('gt', 'greater than', utils));
  Assertion.overwriteMethod('below', override('lt', 'below', utils));
  Assertion.overwriteMethod('lt', override('lt', 'less than', utils));
  Assertion.overwriteMethod('least', override('gte', 'at least', utils));
  Assertion.overwriteMethod('gte', override('gte', 'greater than or equal', utils));
  Assertion.overwriteMethod('most', override('lte', 'at most', utils));
  Assertion.overwriteMethod('lte', override('lte', 'less than or equal', utils));
}

function override(method, name, utils) {
  return function (_super) {
    return overwriteBigNumberFunction(method, name, _super, utils);
  };
}

function overwriteBigNumberFunction(functionName, readableName, _super, chaiUtils) {
  return function () {
    for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
      args[_key] = arguments[_key];
    }

    var actual = args[0];
    var expected = chaiUtils.flag(this, 'object');

    if (ethers.BigNumber.isBigNumber(expected) || ethers.BigNumber.isBigNumber(actual)) {
      this.assert(ethers.BigNumber.from(expected)[functionName](actual), "Expected \"" + expected + "\" to be " + readableName + " " + actual, "Expected \"" + expected + "\" NOT to be " + readableName + " " + actual, expected, actual);
    } else {
      _super.apply(this, args);
    }
  };
}

function supportReverted(Assertion) {
  Assertion.addProperty('reverted', function () {
    var _this = this;

    var promise = this._obj;

    var onSuccess = function onSuccess(value) {
      _this.assert(false, 'Expected transaction to be reverted', 'Expected transaction NOT to be reverted', 'Transaction reverted.', 'Transaction NOT reverted.');

      return value;
    };

    var onError = function onError(error) {
      var message = error instanceof Object && 'message' in error ? error.message : JSON.stringify(error);
      var isReverted = message.search('revert') >= 0;
      var isThrown = message.search('invalid opcode') >= 0;
      var isError = message.search('code=') >= 0;

      _this.assert(isReverted || isThrown || isError, "Expected transaction to be reverted, but other exception was thrown: " + error, 'Expected transaction NOT to be reverted', 'Transaction reverted.', error);

      return error;
    };

    var derivedPromise = promise.then(onSuccess, onError);
    this.then = derivedPromise.then.bind(derivedPromise);
    this["catch"] = derivedPromise["catch"].bind(derivedPromise);
    return this;
  });
}

function supportRevertedWith(Assertion) {
  Assertion.addMethod('revertedWith', function (revertReason) {
    var _this = this;

    var promise = this._obj;

    var onSuccess = function onSuccess(value) {
      _this.assert(false, 'Expected transaction to be reverted', 'Expected transaction NOT to be reverted', 'Transaction reverted.', 'Transaction NOT reverted.');

      return value;
    };

    var onError = function onError(error) {
      // See https://github.com/ethers-io/ethers.js/issues/829
      var isEstimateGasError = error instanceof Object && error.code === 'UNPREDICTABLE_GAS_LIMIT' && 'error' in error;

      if (isEstimateGasError) {
        error = error.error;
      }

      var message = error instanceof Object && 'message' in error ? error.message : JSON.stringify(error);
      var isReverted = message.search('revert') >= 0 && message.search(revertReason) >= 0;
      var isThrown = message.search('invalid opcode') >= 0 && revertReason === '';

      _this.assert(isReverted || isThrown, "Expected transaction to be reverted with " + revertReason + ", but other exception was thrown: " + error, "Expected transaction NOT to be reverted with " + revertReason, "Transaction reverted with " + revertReason + ".", error);

      return error;
    };

    var derivedPromise = promise.then(onSuccess, onError);
    this.then = derivedPromise.then.bind(derivedPromise);
    this["catch"] = derivedPromise["catch"].bind(derivedPromise);
    return this;
  });
}

function supportEmit(Assertion) {
  var filterLogsWithTopics = function filterLogsWithTopics(logs, topic, contractAddress) {
    return logs.filter(function (log) {
      return log.topics.includes(topic);
    }).filter(function (log) {
      return log.address && log.address.toLowerCase() === contractAddress.toLowerCase();
    });
  };

  Assertion.addMethod('emit', function (contract, eventName) {
    var _this = this;

    var promise = this._obj;
    var derivedPromise = promise.then(function (tx) {
      return contract.provider.getTransactionReceipt(tx.hash);
    }).then(function (receipt) {
      var eventFragment;

      try {
        eventFragment = contract["interface"].getEvent(eventName);
      } catch (e) {// ignore error
      }

      if (eventFragment === undefined) {
        var isNegated = _this.__flags.negate === true;

        _this.assert(isNegated, "Expected event \"" + eventName + "\" to be emitted, but it doesn't" + ' exist in the contract. Please make sure you\'ve compiled' + ' its latest version before running the test.', "WARNING: Expected event \"" + eventName + "\" NOT to be emitted." + ' The event wasn\'t emitted because it doesn\'t' + ' exist in the contract. Please make sure you\'ve compiled' + ' its latest version before running the test.', eventName, '');

        return;
      }

      var topic = contract["interface"].getEventTopic(eventFragment);
      _this.logs = filterLogsWithTopics(receipt.logs, topic, contract.address);

      _this.assert(_this.logs.length > 0, "Expected event \"" + eventName + "\" to be emitted, but it wasn't", "Expected event \"" + eventName + "\" NOT to be emitted, but it was");
    });
    this.then = derivedPromise.then.bind(derivedPromise);
    this["catch"] = derivedPromise["catch"].bind(derivedPromise);
    this.promise = derivedPromise;
    this.contract = contract;
    this.eventName = eventName;
    return this;
  });

  var assertArgsArraysEqual = function assertArgsArraysEqual(context, expectedArgs, log) {
    var actualArgs = context.contract["interface"].parseLog(log).args;
    context.assert(actualArgs.length === expectedArgs.length, "Expected \"" + context.eventName + "\" event to have " + expectedArgs.length + " argument(s), " + ("but it has " + actualArgs.length), 'Do not combine .not. with .withArgs()', expectedArgs.length, actualArgs.length);

    for (var index = 0; index < expectedArgs.length; index++) {
      if (expectedArgs[index].length !== undefined && typeof expectedArgs[index] !== 'string') {
        for (var j = 0; j < expectedArgs[index].length; j++) {
          new Assertion(actualArgs[index][j]).equal(expectedArgs[index][j]);
        }
      } else {
        new Assertion(actualArgs[index]).equal(expectedArgs[index]);
      }
    }
  };

  var tryAssertArgsArraysEqual = function tryAssertArgsArraysEqual(context, expectedArgs, logs) {
    if (logs.length === 1) return assertArgsArraysEqual(context, expectedArgs, logs[0]);

    for (var index in logs) {
      try {
        assertArgsArraysEqual(context, expectedArgs, logs[index]);
        return;
      } catch (_unused) {}
    }

    context.assert(false, "Specified args not emitted in any of " + context.logs.length + " emitted \"" + context.eventName + "\" events", 'Do not combine .not. with .withArgs()');
  };

  Assertion.addMethod('withArgs', function () {
    var _this2 = this;

    for (var _len = arguments.length, expectedArgs = new Array(_len), _key = 0; _key < _len; _key++) {
      expectedArgs[_key] = arguments[_key];
    }

    var derivedPromise = this.promise.then(function () {
      tryAssertArgsArraysEqual(_this2, expectedArgs, _this2.logs);
    });
    this.then = derivedPromise.then.bind(derivedPromise);
    this["catch"] = derivedPromise["catch"].bind(derivedPromise);
    return this;
  });
}

function supportProperAddress(Assertion) {
  Assertion.addProperty('properAddress', function () {
    var subject = this._obj;
    this.assert(/^0x[0-9-a-fA-F]{40}$/.test(subject), "Expected \"" + subject + "\" to be a proper address", "Expected \"" + subject + "\" not to be a proper address", 'proper address (eg.: 0x1234567890123456789012345678901234567890)', subject);
  });
}

function supportProperPrivateKey(Assertion) {
  Assertion.addProperty('properPrivateKey', function () {
    var subject = this._obj;
    this.assert(/^0x[0-9-a-fA-F]{64}$/.test(subject), "Expected \"" + subject + "\" to be a proper private key", "Expected \"" + subject + "\" not to be a proper private key", 'proper address (eg.: 0x1234567890123456789012345678901234567890)', subject);
  });
}

function supportProperHex(Assertion) {
  Assertion.addMethod('properHex', function (length) {
    var subject = this._obj;
    var regexp = new RegExp("^0x[0-9-a-fA-F]{" + length + "}$");
    this.assert(regexp.test(subject), "Expected \"" + subject + "\" to be a proper hex of length " + length, "Expected \"" + subject + "\" not to be a proper hex of length " + length + ", but it was", 'proper address (eg.: 0x1234567890123456789012345678901234567890)', subject);
  });
}

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) {
  try {
    var info = gen[key](arg);
    var value = info.value;
  } catch (error) {
    reject(error);
    return;
  }

  if (info.done) {
    resolve(value);
  } else {
    Promise.resolve(value).then(_next, _throw);
  }
}

function _asyncToGenerator(fn) {
  return function () {
    var self = this,
        args = arguments;
    return new Promise(function (resolve, reject) {
      var gen = fn.apply(self, args);

      function _next(value) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value);
      }

      function _throw(err) {
        asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err);
      }

      _next(undefined);
    });
  };
}

function createCommonjsModule(fn, module) {
	return module = { exports: {} }, fn(module, module.exports), module.exports;
}

var runtime_1 = createCommonjsModule(function (module) {
/**
 * Copyright (c) 2014-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

var runtime = (function (exports) {

  var Op = Object.prototype;
  var hasOwn = Op.hasOwnProperty;
  var undefined$1; // More compressible than void 0.
  var $Symbol = typeof Symbol === "function" ? Symbol : {};
  var iteratorSymbol = $Symbol.iterator || "@@iterator";
  var asyncIteratorSymbol = $Symbol.asyncIterator || "@@asyncIterator";
  var toStringTagSymbol = $Symbol.toStringTag || "@@toStringTag";

  function define(obj, key, value) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
    return obj[key];
  }
  try {
    // IE 8 has a broken Object.defineProperty that only works on DOM objects.
    define({}, "");
  } catch (err) {
    define = function(obj, key, value) {
      return obj[key] = value;
    };
  }

  function wrap(innerFn, outerFn, self, tryLocsList) {
    // If outerFn provided and outerFn.prototype is a Generator, then outerFn.prototype instanceof Generator.
    var protoGenerator = outerFn && outerFn.prototype instanceof Generator ? outerFn : Generator;
    var generator = Object.create(protoGenerator.prototype);
    var context = new Context(tryLocsList || []);

    // The ._invoke method unifies the implementations of the .next,
    // .throw, and .return methods.
    generator._invoke = makeInvokeMethod(innerFn, self, context);

    return generator;
  }
  exports.wrap = wrap;

  // Try/catch helper to minimize deoptimizations. Returns a completion
  // record like context.tryEntries[i].completion. This interface could
  // have been (and was previously) designed to take a closure to be
  // invoked without arguments, but in all the cases we care about we
  // already have an existing method we want to call, so there's no need
  // to create a new function object. We can even get away with assuming
  // the method takes exactly one argument, since that happens to be true
  // in every case, so we don't have to touch the arguments object. The
  // only additional allocation required is the completion record, which
  // has a stable shape and so hopefully should be cheap to allocate.
  function tryCatch(fn, obj, arg) {
    try {
      return { type: "normal", arg: fn.call(obj, arg) };
    } catch (err) {
      return { type: "throw", arg: err };
    }
  }

  var GenStateSuspendedStart = "suspendedStart";
  var GenStateSuspendedYield = "suspendedYield";
  var GenStateExecuting = "executing";
  var GenStateCompleted = "completed";

  // Returning this object from the innerFn has the same effect as
  // breaking out of the dispatch switch statement.
  var ContinueSentinel = {};

  // Dummy constructor functions that we use as the .constructor and
  // .constructor.prototype properties for functions that return Generator
  // objects. For full spec compliance, you may wish to configure your
  // minifier not to mangle the names of these two functions.
  function Generator() {}
  function GeneratorFunction() {}
  function GeneratorFunctionPrototype() {}

  // This is a polyfill for %IteratorPrototype% for environments that
  // don't natively support it.
  var IteratorPrototype = {};
  define(IteratorPrototype, iteratorSymbol, function () {
    return this;
  });

  var getProto = Object.getPrototypeOf;
  var NativeIteratorPrototype = getProto && getProto(getProto(values([])));
  if (NativeIteratorPrototype &&
      NativeIteratorPrototype !== Op &&
      hasOwn.call(NativeIteratorPrototype, iteratorSymbol)) {
    // This environment has a native %IteratorPrototype%; use it instead
    // of the polyfill.
    IteratorPrototype = NativeIteratorPrototype;
  }

  var Gp = GeneratorFunctionPrototype.prototype =
    Generator.prototype = Object.create(IteratorPrototype);
  GeneratorFunction.prototype = GeneratorFunctionPrototype;
  define(Gp, "constructor", GeneratorFunctionPrototype);
  define(GeneratorFunctionPrototype, "constructor", GeneratorFunction);
  GeneratorFunction.displayName = define(
    GeneratorFunctionPrototype,
    toStringTagSymbol,
    "GeneratorFunction"
  );

  // Helper for defining the .next, .throw, and .return methods of the
  // Iterator interface in terms of a single ._invoke method.
  function defineIteratorMethods(prototype) {
    ["next", "throw", "return"].forEach(function(method) {
      define(prototype, method, function(arg) {
        return this._invoke(method, arg);
      });
    });
  }

  exports.isGeneratorFunction = function(genFun) {
    var ctor = typeof genFun === "function" && genFun.constructor;
    return ctor
      ? ctor === GeneratorFunction ||
        // For the native GeneratorFunction constructor, the best we can
        // do is to check its .name property.
        (ctor.displayName || ctor.name) === "GeneratorFunction"
      : false;
  };

  exports.mark = function(genFun) {
    if (Object.setPrototypeOf) {
      Object.setPrototypeOf(genFun, GeneratorFunctionPrototype);
    } else {
      genFun.__proto__ = GeneratorFunctionPrototype;
      define(genFun, toStringTagSymbol, "GeneratorFunction");
    }
    genFun.prototype = Object.create(Gp);
    return genFun;
  };

  // Within the body of any async function, `await x` is transformed to
  // `yield regeneratorRuntime.awrap(x)`, so that the runtime can test
  // `hasOwn.call(value, "__await")` to determine if the yielded value is
  // meant to be awaited.
  exports.awrap = function(arg) {
    return { __await: arg };
  };

  function AsyncIterator(generator, PromiseImpl) {
    function invoke(method, arg, resolve, reject) {
      var record = tryCatch(generator[method], generator, arg);
      if (record.type === "throw") {
        reject(record.arg);
      } else {
        var result = record.arg;
        var value = result.value;
        if (value &&
            typeof value === "object" &&
            hasOwn.call(value, "__await")) {
          return PromiseImpl.resolve(value.__await).then(function(value) {
            invoke("next", value, resolve, reject);
          }, function(err) {
            invoke("throw", err, resolve, reject);
          });
        }

        return PromiseImpl.resolve(value).then(function(unwrapped) {
          // When a yielded Promise is resolved, its final value becomes
          // the .value of the Promise<{value,done}> result for the
          // current iteration.
          result.value = unwrapped;
          resolve(result);
        }, function(error) {
          // If a rejected Promise was yielded, throw the rejection back
          // into the async generator function so it can be handled there.
          return invoke("throw", error, resolve, reject);
        });
      }
    }

    var previousPromise;

    function enqueue(method, arg) {
      function callInvokeWithMethodAndArg() {
        return new PromiseImpl(function(resolve, reject) {
          invoke(method, arg, resolve, reject);
        });
      }

      return previousPromise =
        // If enqueue has been called before, then we want to wait until
        // all previous Promises have been resolved before calling invoke,
        // so that results are always delivered in the correct order. If
        // enqueue has not been called before, then it is important to
        // call invoke immediately, without waiting on a callback to fire,
        // so that the async generator function has the opportunity to do
        // any necessary setup in a predictable way. This predictability
        // is why the Promise constructor synchronously invokes its
        // executor callback, and why async functions synchronously
        // execute code before the first await. Since we implement simple
        // async functions in terms of async generators, it is especially
        // important to get this right, even though it requires care.
        previousPromise ? previousPromise.then(
          callInvokeWithMethodAndArg,
          // Avoid propagating failures to Promises returned by later
          // invocations of the iterator.
          callInvokeWithMethodAndArg
        ) : callInvokeWithMethodAndArg();
    }

    // Define the unified helper method that is used to implement .next,
    // .throw, and .return (see defineIteratorMethods).
    this._invoke = enqueue;
  }

  defineIteratorMethods(AsyncIterator.prototype);
  define(AsyncIterator.prototype, asyncIteratorSymbol, function () {
    return this;
  });
  exports.AsyncIterator = AsyncIterator;

  // Note that simple async functions are implemented on top of
  // AsyncIterator objects; they just return a Promise for the value of
  // the final result produced by the iterator.
  exports.async = function(innerFn, outerFn, self, tryLocsList, PromiseImpl) {
    if (PromiseImpl === void 0) PromiseImpl = Promise;

    var iter = new AsyncIterator(
      wrap(innerFn, outerFn, self, tryLocsList),
      PromiseImpl
    );

    return exports.isGeneratorFunction(outerFn)
      ? iter // If outerFn is a generator, return the full iterator.
      : iter.next().then(function(result) {
          return result.done ? result.value : iter.next();
        });
  };

  function makeInvokeMethod(innerFn, self, context) {
    var state = GenStateSuspendedStart;

    return function invoke(method, arg) {
      if (state === GenStateExecuting) {
        throw new Error("Generator is already running");
      }

      if (state === GenStateCompleted) {
        if (method === "throw") {
          throw arg;
        }

        // Be forgiving, per 25.3.3.3.3 of the spec:
        // https://people.mozilla.org/~jorendorff/es6-draft.html#sec-generatorresume
        return doneResult();
      }

      context.method = method;
      context.arg = arg;

      while (true) {
        var delegate = context.delegate;
        if (delegate) {
          var delegateResult = maybeInvokeDelegate(delegate, context);
          if (delegateResult) {
            if (delegateResult === ContinueSentinel) continue;
            return delegateResult;
          }
        }

        if (context.method === "next") {
          // Setting context._sent for legacy support of Babel's
          // function.sent implementation.
          context.sent = context._sent = context.arg;

        } else if (context.method === "throw") {
          if (state === GenStateSuspendedStart) {
            state = GenStateCompleted;
            throw context.arg;
          }

          context.dispatchException(context.arg);

        } else if (context.method === "return") {
          context.abrupt("return", context.arg);
        }

        state = GenStateExecuting;

        var record = tryCatch(innerFn, self, context);
        if (record.type === "normal") {
          // If an exception is thrown from innerFn, we leave state ===
          // GenStateExecuting and loop back for another invocation.
          state = context.done
            ? GenStateCompleted
            : GenStateSuspendedYield;

          if (record.arg === ContinueSentinel) {
            continue;
          }

          return {
            value: record.arg,
            done: context.done
          };

        } else if (record.type === "throw") {
          state = GenStateCompleted;
          // Dispatch the exception by looping back around to the
          // context.dispatchException(context.arg) call above.
          context.method = "throw";
          context.arg = record.arg;
        }
      }
    };
  }

  // Call delegate.iterator[context.method](context.arg) and handle the
  // result, either by returning a { value, done } result from the
  // delegate iterator, or by modifying context.method and context.arg,
  // setting context.delegate to null, and returning the ContinueSentinel.
  function maybeInvokeDelegate(delegate, context) {
    var method = delegate.iterator[context.method];
    if (method === undefined$1) {
      // A .throw or .return when the delegate iterator has no .throw
      // method always terminates the yield* loop.
      context.delegate = null;

      if (context.method === "throw") {
        // Note: ["return"] must be used for ES3 parsing compatibility.
        if (delegate.iterator["return"]) {
          // If the delegate iterator has a return method, give it a
          // chance to clean up.
          context.method = "return";
          context.arg = undefined$1;
          maybeInvokeDelegate(delegate, context);

          if (context.method === "throw") {
            // If maybeInvokeDelegate(context) changed context.method from
            // "return" to "throw", let that override the TypeError below.
            return ContinueSentinel;
          }
        }

        context.method = "throw";
        context.arg = new TypeError(
          "The iterator does not provide a 'throw' method");
      }

      return ContinueSentinel;
    }

    var record = tryCatch(method, delegate.iterator, context.arg);

    if (record.type === "throw") {
      context.method = "throw";
      context.arg = record.arg;
      context.delegate = null;
      return ContinueSentinel;
    }

    var info = record.arg;

    if (! info) {
      context.method = "throw";
      context.arg = new TypeError("iterator result is not an object");
      context.delegate = null;
      return ContinueSentinel;
    }

    if (info.done) {
      // Assign the result of the finished delegate to the temporary
      // variable specified by delegate.resultName (see delegateYield).
      context[delegate.resultName] = info.value;

      // Resume execution at the desired location (see delegateYield).
      context.next = delegate.nextLoc;

      // If context.method was "throw" but the delegate handled the
      // exception, let the outer generator proceed normally. If
      // context.method was "next", forget context.arg since it has been
      // "consumed" by the delegate iterator. If context.method was
      // "return", allow the original .return call to continue in the
      // outer generator.
      if (context.method !== "return") {
        context.method = "next";
        context.arg = undefined$1;
      }

    } else {
      // Re-yield the result returned by the delegate method.
      return info;
    }

    // The delegate iterator is finished, so forget it and continue with
    // the outer generator.
    context.delegate = null;
    return ContinueSentinel;
  }

  // Define Generator.prototype.{next,throw,return} in terms of the
  // unified ._invoke helper method.
  defineIteratorMethods(Gp);

  define(Gp, toStringTagSymbol, "Generator");

  // A Generator should always return itself as the iterator object when the
  // @@iterator function is called on it. Some browsers' implementations of the
  // iterator prototype chain incorrectly implement this, causing the Generator
  // object to not be returned from this call. This ensures that doesn't happen.
  // See https://github.com/facebook/regenerator/issues/274 for more details.
  define(Gp, iteratorSymbol, function() {
    return this;
  });

  define(Gp, "toString", function() {
    return "[object Generator]";
  });

  function pushTryEntry(locs) {
    var entry = { tryLoc: locs[0] };

    if (1 in locs) {
      entry.catchLoc = locs[1];
    }

    if (2 in locs) {
      entry.finallyLoc = locs[2];
      entry.afterLoc = locs[3];
    }

    this.tryEntries.push(entry);
  }

  function resetTryEntry(entry) {
    var record = entry.completion || {};
    record.type = "normal";
    delete record.arg;
    entry.completion = record;
  }

  function Context(tryLocsList) {
    // The root entry object (effectively a try statement without a catch
    // or a finally block) gives us a place to store values thrown from
    // locations where there is no enclosing try statement.
    this.tryEntries = [{ tryLoc: "root" }];
    tryLocsList.forEach(pushTryEntry, this);
    this.reset(true);
  }

  exports.keys = function(object) {
    var keys = [];
    for (var key in object) {
      keys.push(key);
    }
    keys.reverse();

    // Rather than returning an object with a next method, we keep
    // things simple and return the next function itself.
    return function next() {
      while (keys.length) {
        var key = keys.pop();
        if (key in object) {
          next.value = key;
          next.done = false;
          return next;
        }
      }

      // To avoid creating an additional object, we just hang the .value
      // and .done properties off the next function object itself. This
      // also ensures that the minifier will not anonymize the function.
      next.done = true;
      return next;
    };
  };

  function values(iterable) {
    if (iterable) {
      var iteratorMethod = iterable[iteratorSymbol];
      if (iteratorMethod) {
        return iteratorMethod.call(iterable);
      }

      if (typeof iterable.next === "function") {
        return iterable;
      }

      if (!isNaN(iterable.length)) {
        var i = -1, next = function next() {
          while (++i < iterable.length) {
            if (hasOwn.call(iterable, i)) {
              next.value = iterable[i];
              next.done = false;
              return next;
            }
          }

          next.value = undefined$1;
          next.done = true;

          return next;
        };

        return next.next = next;
      }
    }

    // Return an iterator with no values.
    return { next: doneResult };
  }
  exports.values = values;

  function doneResult() {
    return { value: undefined$1, done: true };
  }

  Context.prototype = {
    constructor: Context,

    reset: function(skipTempReset) {
      this.prev = 0;
      this.next = 0;
      // Resetting context._sent for legacy support of Babel's
      // function.sent implementation.
      this.sent = this._sent = undefined$1;
      this.done = false;
      this.delegate = null;

      this.method = "next";
      this.arg = undefined$1;

      this.tryEntries.forEach(resetTryEntry);

      if (!skipTempReset) {
        for (var name in this) {
          // Not sure about the optimal order of these conditions:
          if (name.charAt(0) === "t" &&
              hasOwn.call(this, name) &&
              !isNaN(+name.slice(1))) {
            this[name] = undefined$1;
          }
        }
      }
    },

    stop: function() {
      this.done = true;

      var rootEntry = this.tryEntries[0];
      var rootRecord = rootEntry.completion;
      if (rootRecord.type === "throw") {
        throw rootRecord.arg;
      }

      return this.rval;
    },

    dispatchException: function(exception) {
      if (this.done) {
        throw exception;
      }

      var context = this;
      function handle(loc, caught) {
        record.type = "throw";
        record.arg = exception;
        context.next = loc;

        if (caught) {
          // If the dispatched exception was caught by a catch block,
          // then let that catch block handle the exception normally.
          context.method = "next";
          context.arg = undefined$1;
        }

        return !! caught;
      }

      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        var record = entry.completion;

        if (entry.tryLoc === "root") {
          // Exception thrown outside of any try block that could handle
          // it, so set the completion value of the entire function to
          // throw the exception.
          return handle("end");
        }

        if (entry.tryLoc <= this.prev) {
          var hasCatch = hasOwn.call(entry, "catchLoc");
          var hasFinally = hasOwn.call(entry, "finallyLoc");

          if (hasCatch && hasFinally) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            } else if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else if (hasCatch) {
            if (this.prev < entry.catchLoc) {
              return handle(entry.catchLoc, true);
            }

          } else if (hasFinally) {
            if (this.prev < entry.finallyLoc) {
              return handle(entry.finallyLoc);
            }

          } else {
            throw new Error("try statement without catch or finally");
          }
        }
      }
    },

    abrupt: function(type, arg) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc <= this.prev &&
            hasOwn.call(entry, "finallyLoc") &&
            this.prev < entry.finallyLoc) {
          var finallyEntry = entry;
          break;
        }
      }

      if (finallyEntry &&
          (type === "break" ||
           type === "continue") &&
          finallyEntry.tryLoc <= arg &&
          arg <= finallyEntry.finallyLoc) {
        // Ignore the finally entry if control is not jumping to a
        // location outside the try/catch block.
        finallyEntry = null;
      }

      var record = finallyEntry ? finallyEntry.completion : {};
      record.type = type;
      record.arg = arg;

      if (finallyEntry) {
        this.method = "next";
        this.next = finallyEntry.finallyLoc;
        return ContinueSentinel;
      }

      return this.complete(record);
    },

    complete: function(record, afterLoc) {
      if (record.type === "throw") {
        throw record.arg;
      }

      if (record.type === "break" ||
          record.type === "continue") {
        this.next = record.arg;
      } else if (record.type === "return") {
        this.rval = this.arg = record.arg;
        this.method = "return";
        this.next = "end";
      } else if (record.type === "normal" && afterLoc) {
        this.next = afterLoc;
      }

      return ContinueSentinel;
    },

    finish: function(finallyLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.finallyLoc === finallyLoc) {
          this.complete(entry.completion, entry.afterLoc);
          resetTryEntry(entry);
          return ContinueSentinel;
        }
      }
    },

    "catch": function(tryLoc) {
      for (var i = this.tryEntries.length - 1; i >= 0; --i) {
        var entry = this.tryEntries[i];
        if (entry.tryLoc === tryLoc) {
          var record = entry.completion;
          if (record.type === "throw") {
            var thrown = record.arg;
            resetTryEntry(entry);
          }
          return thrown;
        }
      }

      // The context.catch method must only be called with a location
      // argument that corresponds to a known catch block.
      throw new Error("illegal catch attempt");
    },

    delegateYield: function(iterable, resultName, nextLoc) {
      this.delegate = {
        iterator: values(iterable),
        resultName: resultName,
        nextLoc: nextLoc
      };

      if (this.method === "next") {
        // Deliberately forget the last sent value so that we don't
        // accidentally pass it on to the delegate.
        this.arg = undefined$1;
      }

      return ContinueSentinel;
    }
  };

  // Regardless of whether this script is executing as a CommonJS module
  // or not, return the runtime object so that we can declare the variable
  // regeneratorRuntime in the outer scope, which allows this module to be
  // injected easily by `bin/regenerator --include-runtime script.js`.
  return exports;

}(
  // If this script is executing as a CommonJS module, use module.exports
  // as the regeneratorRuntime namespace. Otherwise create a new empty
  // object. Either way, the resulting object will be used to initialize
  // the regeneratorRuntime variable at the top of this file.
   module.exports 
));

try {
  regeneratorRuntime = runtime;
} catch (accidentalStrictMode) {
  // This module should not be running in strict mode, so the above
  // assignment should always work unless something is misconfigured. Just
  // in case runtime.js accidentally runs in strict mode, in modern engines
  // we can explicitly access globalThis. In older engines we can escape
  // strict mode using a global Function call. This could conceivably fail
  // if a Content Security Policy forbids using Function, but in that case
  // the proper solution is to fix the accidental strict mode problem. If
  // you've misconfigured your bundler to force strict mode and applied a
  // CSP to forbid Function, and you're not willing to fix either of those
  // problems, please detail your unique predicament in a GitHub issue.
  if (typeof globalThis === "object") {
    globalThis.regeneratorRuntime = runtime;
  } else {
    Function("r", "regeneratorRuntime = r")(runtime);
  }
}
});

function isAccount(account) {
  return account instanceof ethers.Contract || account instanceof ethers.Wallet;
}
function getAddressOf(_x) {
  return _getAddressOf.apply(this, arguments);
}

function _getAddressOf() {
  _getAddressOf = _asyncToGenerator( /*#__PURE__*/runtime_1.mark(function _callee(account) {
    return runtime_1.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            if (!isAccount(account)) {
              _context.next = 4;
              break;
            }

            return _context.abrupt("return", account.address);

          case 4:
            return _context.abrupt("return", account.getAddress());

          case 5:
          case "end":
            return _context.stop();
        }
      }
    }, _callee);
  }));
  return _getAddressOf.apply(this, arguments);
}

function supportChangeTokenBalance(Assertion) {
  Assertion.addMethod('changeTokenBalance', function (token, signer, balanceChange) {
    var _this = this;

    var subject = this._obj;
    var derivedPromise = Promise.all([getBalanceChangeForTransactionCall(subject, token, signer), getAddressOf(signer)]).then(function (_ref) {
      var actualChange = _ref[0],
          address = _ref[1];

      _this.assert(actualChange.eq(ethers.BigNumber.from(balanceChange)), "Expected \"" + address + "\" to change balance by " + balanceChange + " wei, " + ("but it has changed by " + actualChange + " wei"), "Expected \"" + address + "\" to not change balance by " + balanceChange + " wei,", balanceChange, actualChange);
    });
    this.then = derivedPromise.then.bind(derivedPromise);
    this["catch"] = derivedPromise["catch"].bind(derivedPromise);
    this.promise = derivedPromise;
    return this;
  });
}

function getBalanceChangeForTransactionCall(_x, _x2, _x3) {
  return _getBalanceChangeForTransactionCall.apply(this, arguments);
}

function _getBalanceChangeForTransactionCall() {
  _getBalanceChangeForTransactionCall = _asyncToGenerator( /*#__PURE__*/runtime_1.mark(function _callee(transactionCall, token, account) {
    var balanceBefore, balanceAfter;
    return runtime_1.wrap(function _callee$(_context) {
      while (1) {
        switch (_context.prev = _context.next) {
          case 0:
            _context.t0 = token;
            _context.next = 3;
            return getAddressOf(account);

          case 3:
            _context.t1 = _context.sent;
            _context.next = 6;
            return _context.t0.balanceOf.call(_context.t0, _context.t1);

          case 6:
            balanceBefore = _context.sent;
            _context.next = 9;
            return transactionCall();

          case 9:
            _context.t2 = token;
            _context.next = 12;
            return getAddressOf(account);

          case 12:
            _context.t3 = _context.sent;
            _context.next = 15;
            return _context.t2.balanceOf.call(_context.t2, _context.t3);

          case 15:
            balanceAfter = _context.sent;
            return _context.abrupt("return", balanceAfter.sub(balanceBefore));

          case 17:
          case "end":
            return _context.stop();
        }
      }
    }, _callee);
  }));
  return _getBalanceChangeForTransactionCall.apply(this, arguments);
}

function supportChangeTokenBalances(Assertion) {
  Assertion.addMethod('changeTokenBalances', function (token, signers, balanceChanges) {
    var _this = this;

    var subject = this._obj;
    var derivedPromise = Promise.all([getBalanceChangeForTransactionCall$1(subject, token, signers), getAddresses(signers)]).then(function (_ref) {
      var actualChanges = _ref[0],
          signerAddresses = _ref[1];

      _this.assert(actualChanges.every(function (change, ind) {
        return change.eq(ethers.BigNumber.from(balanceChanges[ind]));
      }), "Expected " + signerAddresses + " to change balance by " + balanceChanges + " wei, " + ("but it has changed by " + actualChanges + " wei"), "Expected " + signerAddresses + " to not change balance by " + balanceChanges + " wei,", balanceChanges.map(function (balanceChange) {
        return balanceChange.toString();
      }), actualChanges.map(function (actualChange) {
        return actualChange.toString();
      }));
    });
    this.then = derivedPromise.then.bind(derivedPromise);
    this["catch"] = derivedPromise["catch"].bind(derivedPromise);
    this.promise = derivedPromise;
    return this;
  });
}

function getAddresses(accounts) {
  return Promise.all(accounts.map(function (account) {
    return getAddressOf(account);
  }));
}

function getBalances(_x, _x2) {
  return _getBalances.apply(this, arguments);
}

function _getBalances() {
  _getBalances = _asyncToGenerator( /*#__PURE__*/runtime_1.mark(function _callee2(token, accounts) {
    return runtime_1.wrap(function _callee2$(_context2) {
      while (1) {
        switch (_context2.prev = _context2.next) {
          case 0:
            return _context2.abrupt("return", Promise.all(accounts.map( /*#__PURE__*/function () {
              var _ref2 = _asyncToGenerator( /*#__PURE__*/runtime_1.mark(function _callee(account) {
                return runtime_1.wrap(function _callee$(_context) {
                  while (1) {
                    switch (_context.prev = _context.next) {
                      case 0:
                        return _context.abrupt("return", token.balanceOf(getAddressOf(account)));

                      case 1:
                      case "end":
                        return _context.stop();
                    }
                  }
                }, _callee);
              }));

              return function (_x6) {
                return _ref2.apply(this, arguments);
              };
            }())));

          case 1:
          case "end":
            return _context2.stop();
        }
      }
    }, _callee2);
  }));
  return _getBalances.apply(this, arguments);
}

function getBalanceChangeForTransactionCall$1(_x3, _x4, _x5) {
  return _getBalanceChangeForTransactionCall$1.apply(this, arguments);
}

function _getBalanceChangeForTransactionCall$1() {
  _getBalanceChangeForTransactionCall$1 = _asyncToGenerator( /*#__PURE__*/runtime_1.mark(function _callee3(transactionCall, token, accounts) {
    var balancesBefore, balancesAfter;
    return runtime_1.wrap(function _callee3$(_context3) {
      while (1) {
        switch (_context3.prev = _context3.next) {
          case 0:
            _context3.next = 2;
            return getBalances(token, accounts);

          case 2:
            balancesBefore = _context3.sent;
            _context3.next = 5;
            return transactionCall();

          case 5:
            _context3.next = 7;
            return getBalances(token, accounts);

          case 7:
            balancesAfter = _context3.sent;
            return _context3.abrupt("return", balancesAfter.map(function (balance, ind) {
              return balance.sub(balancesBefore[ind]);
            }));

          case 9:
          case "end":
            return _context3.stop();
        }
      }
    }, _callee3);
  }));
  return _getBalanceChangeForTransactionCall$1.apply(this, arguments);
}

function chaiEthers(chai, utils) {
  supportBigNumber(chai.Assertion, utils);
  supportReverted(chai.Assertion);
  supportRevertedWith(chai.Assertion);
  supportEmit(chai.Assertion);
  supportProperAddress(chai.Assertion);
  supportProperPrivateKey(chai.Assertion);
  supportProperHex(chai.Assertion);
  supportChangeTokenBalance(chai.Assertion);
  supportChangeTokenBalances(chai.Assertion);
}

exports.chaiEthers = chaiEthers;
//# sourceMappingURL=assert-evm.cjs.development.js.map
