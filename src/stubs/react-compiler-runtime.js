// Stub for react/compiler-runtime (React 19+ compiler cache primitives)
// React 18 doesn't include this module; this stub provides the minimal API.
"use strict";

// c(size) allocates a memoization cache slot array used by the React compiler.
export function c(size) {
  return new Array(size);
}
