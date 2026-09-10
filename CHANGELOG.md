# Changelog

## [12.1.0](https://github.com/workadventure/simple-peer/compare/v12.0.1...v12.1.0) (2026-09-10)


### Features

* receive-side codec preferences with an exclusive mode, applied before the answer too ([994aad7](https://github.com/workadventure/simple-peer/commit/994aad784bee1eea01111e6a6a93166c5420eebf))

## [12.0.1](https://github.com/workadventure/simple-peer/compare/v12.0.0...v12.0.1) (2026-03-16)


### Bug Fixes

* Allow readding removed streams/tracks ([a2955ae](https://github.com/workadventure/simple-peer/commit/a2955aef24724bba1d673697564aca87b541a55d))

## [12.0.0](https://github.com/workadventure/simple-peer/compare/v11.0.2...v12.0.0) (2026-01-22)


### ⚠ BREAKING CHANGES

* Migration to Vite

### Features

* add preferred codec support and real browser verification ([8676482](https://github.com/workadventure/simple-peer/commit/867648293933dc53e415d537f8a1090289261aa2))
* Migration to Vite ([0d0cd92](https://github.com/workadventure/simple-peer/commit/0d0cd92f8ef9ab941fae44363358b5b824dedf1e))

## [11.0.2](https://github.com/workadventure/simple-peer/compare/v11.0.1...v11.0.2) (2025-12-25)


### Bug Fixes

* Fixing type of PeerEvents ([339a673](https://github.com/workadventure/simple-peer/commit/339a67366bdd655474937870e6c50e93248f1c52))
* Turning "data" event to Uint8Array only for now (to keep compatibility with old versions) ([#15](https://github.com/workadventure/simple-peer/issues/15)) ([c4d7ba4](https://github.com/workadventure/simple-peer/commit/c4d7ba40204ce2dc8bd0a094bf3cb043a9076c8d))

## 11.0.1 (2025-12-23)


### Features

* 10.0.10 ([62179ec](https://github.com/workadventure/simple-peer/commit/62179ec0883c64772755d62fcd207caffab54456))
* 10.0.8 ([d7af19b](https://github.com/workadventure/simple-peer/commit/d7af19b72b643ec8be73edff2089c2a602752e8c))
* 10.0.9 ([eb9bf5b](https://github.com/workadventure/simple-peer/commit/eb9bf5b793c82fe86d2037c1c118d43a3bfc5c5c))
* connect and disconnect events ([c823ee3](https://github.com/workadventure/simple-peer/commit/c823ee35c8f566ac72a941611dd92001dbec13a4))
* ESM ([b19e078](https://github.com/workadventure/simple-peer/commit/b19e07879707c0acdaad693542c6cd0bdd2d0185))
* Migrating from semantic-release to release-please ([7868de4](https://github.com/workadventure/simple-peer/commit/7868de4735378f5e0121c99e537a1d6b20992e42))
* peer-lite ([4ac6135](https://github.com/workadventure/simple-peer/commit/4ac6135f8d6eb3a9eb2a4506e6ad3e74394fb754))
* polyfill WebRTC in Node ([15ece8e](https://github.com/workadventure/simple-peer/commit/15ece8e079c518ef9a582cc4d21f0a85b466c020))
* take over after feross ([4b879f1](https://github.com/workadventure/simple-peer/commit/4b879f150ee9f5d5132dab8c9f76e3e8c44e704a))


### Bug Fixes

* 670 ([68b7647](https://github.com/workadventure/simple-peer/commit/68b7647ec5dd93dd4009566329e7df8cd706609d))
* add buffer ([67f167d](https://github.com/workadventure/simple-peer/commit/67f167df43f33f4b9f8412fdd7f8f19f8152cdf1))
* add code property to thrown errors ([41ba06d](https://github.com/workadventure/simple-peer/commit/41ba06d3157b6c609c5927509b2f20bbdc843d06))
* dependency issues ([7381b03](https://github.com/workadventure/simple-peer/commit/7381b0371b1b85c9c0ed54adc767c188a643e8c3))
* make error the second argument should be error code ([a2c8c4b](https://github.com/workadventure/simple-peer/commit/a2c8c4bba6b946a892538481868e56bba4f5eea8))
* migrate to streamx ([64b2288](https://github.com/workadventure/simple-peer/commit/64b22885807a114911397cfb176429ff4c2fceb5))
* **package:** update debug to version 4.0.1 ([631337f](https://github.com/workadventure/simple-peer/commit/631337f971ded5969d094d6b0e252d3b925019c6)), closes [#358](https://github.com/workadventure/simple-peer/issues/358)
* Removing built files (they are in dist/ folder now and will be auto-built) ([#5](https://github.com/workadventure/simple-peer/issues/5)) ([cd2e434](https://github.com/workadventure/simple-peer/commit/cd2e43406d860cfebfbee2c8f762a07ff03791d6))
* Replacing all URLs from thaunknown/simple-peer to workadventure/simple-peer ([#7](https://github.com/workadventure/simple-peer/issues/7)) ([17dd7ca](https://github.com/workadventure/simple-peer/commit/17dd7cac719f52c5d053b2bde31f309d01c9f21b))
* revert streamx to 2.17 ([1d2d5d5](https://github.com/workadventure/simple-peer/commit/1d2d5d53611fe4550d99f546edb9f84008dc55ad))
* tests ([3155958](https://github.com/workadventure/simple-peer/commit/3155958515203381a209aa405104911a7665f43a))
* Trying to fix semantic-release config ([a6cf71f](https://github.com/workadventure/simple-peer/commit/a6cf71faa48bcac3ec901a609221dcb60811f74b))
* updating "write" signature to accept same types as "send" ([0998cb3](https://github.com/workadventure/simple-peer/commit/0998cb3176c7f26185abf26bdd7e4041ed3476f1))


### Performance Improvements

* drop buffer ([b19e078](https://github.com/workadventure/simple-peer/commit/b19e07879707c0acdaad693542c6cd0bdd2d0185))
