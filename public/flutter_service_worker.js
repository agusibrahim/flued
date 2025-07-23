'use strict';
const MANIFEST = 'flutter-app-manifest';
const TEMP = 'flutter-temp-cache';
const CACHE_NAME = 'flutter-app-cache';

const RESOURCES = {"flutter_bootstrap.js": "bbde71d9f0f61f8b383733df03d954e3",
"version.json": "54469e01ea57b5469fd480b88fa85573",
"codemirror/codemirror.js": "c024b5d532b693ea9faaab52be85acfa",
"codemirror/css/codemirror.css": "05d0504a0124d330548b08ce840c7821",
"codemirror/codemirror.css": "a416d3257f5ca8dae10ad890495a7865",
"index.html": "c26a061c537909370bc128673850142b",
"/": "c26a061c537909370bc128673850142b",
"embed_demo.html": "95c714e7845def6d5b6a8bd20971c07f",
"frame.html": "af5370ee1ca09ee3ce371499ef1b7dea",
"main.dart.js": "06926c612d83b9a623cb361270378918",
"flutter.js": "83d881c1dbb6d6bcd6b42e274605b69c",
"frame/assets/AssetManifest.json": "fdcbd96a960a29b691d052a98cf3e4d5",
"frame/assets/FontManifest.json": "dc3d03800ccca4601324923c0b1d6d57",
"frame/assets/AssetManifest.bin.json": "b352cad213979a84215e890303515519",
"frame/assets/packages/cupertino_icons/assets/CupertinoIcons.ttf": "6d342eb68f170c97609e9da345464e5e",
"frame/assets/AssetManifest.bin": "7371cc65a07d6c16f896f62f6c5bddf3",
"frame/assets/fonts/MaterialIcons-Regular.otf": "e7069dfd19b331be16bed984668fe080",
"main.dart.wasm.map": "57f3ca4dac78df0cb342a8f46022a7b2",
"styles/cm-dartpad-light.css": "6a94f3eb3e9e7166eef8276779ac98c7",
"styles/cm-dartpad-dark.css": "2a72a54d7e4bf68f66ded1d639aba80f",
"require.js": "9f7c9569dd91641d6252b6043374fe7c",
"favicon.png": "c3ce0cac0f74c34597ce4275b2f9f4e4",
"main.dart.mjs": "f52188a5581f973b352a916b9e2c78f8",
"icons/Icon-192.png": "56f4de7eb9e876f9d70dc2d527531991",
"icons/Icon-maskable-192.png": "9dec69d424d0bf8be2a6fd90d9d156b2",
"icons/Icon-maskable-512.png": "6b35299d4fc50fcebb73eb932c4602df",
"icons/Icon-512.png": "4ee3f1d738227093fc70d663f91e5892",
"manifest.json": "36b3d9b6e98ac3d26b1292c6a261ea72",
"ga.js": "db3ecc451e46f4ccc6a84241b3f7d34b",
"main.dart.wasm": "b4da1b81af3c51a06e4eecd138175985",
"assets/AssetManifest.json": "25ab16c20d37b7802942c2ff56b86b5b",
"assets/NOTICES": "f1dc9d502bcf7a581aca39f37d71dd1e",
"assets/FontManifest.json": "77ed76dcf720e00c7aaad85062613ff9",
"assets/AssetManifest.bin.json": "5e71ab37011c937df974e953b70cc626",
"assets/shaders/ink_sparkle.frag": "ecc85a2e95f5e9f53123dcaf8cb9b6ce",
"assets/AssetManifest.bin": "0766988ca184f05fcea69471ec56c652",
"assets/fonts/MaterialIcons-Regular.otf": "bd31e2d498b757dec94e72839c27c5a4",
"assets/assets/prompt_suggestion_icon_lightmode.png": "70e9e40f5af88fe97024cb2bbbdc662f",
"assets/assets/dart_logo_192.png": "56f4de7eb9e876f9d70dc2d527531991",
"assets/assets/RobotoMono-Regular.ttf": "5b04fdfec4c8c36e8ca574e40b7148bb",
"assets/assets/firebase_studio_192.png": "66b00cc1088870670fea4406b5a3a84a",
"assets/assets/prompt_suggestion_icon_darkmode.png": "7907723972e42125d8738f6e96ad5514",
"assets/assets/flutter_logo_192.png": "6ba940675e2cd74bde86ba0bd4201309",
"assets/assets/flame_logo_192.png": "3e135d2716e2995472b9a7152023e663",
"assets/assets/hot-reload.png": "4a05189ee22691ea8af86173b520455d",
"assets/assets/gemini_sparkle_192.png": "114879d98a4274df425b139967eb56c2",
"assets/assets/RobotoMono-Bold.ttf": "90190d91283189e340b2a44fe560f2cd",
"frame.js": "fc7ab46d147728a0a6c57de5b0dd1cbd",
"canvaskit/skwasm.js": "ea559890a088fe28b4ddf70e17e60052",
"canvaskit/skwasm.js.symbols": "e72c79950c8a8483d826a7f0560573a1",
"canvaskit/canvaskit.js.symbols": "bdcd3835edf8586b6d6edfce8749fb77",
"canvaskit/skwasm.wasm": "39dd80367a4e71582d234948adc521c0",
"canvaskit/chromium/canvaskit.js.symbols": "b61b5f4673c9698029fa0a746a9ad581",
"canvaskit/chromium/canvaskit.js": "8191e843020c832c9cf8852a4b909d4c",
"canvaskit/chromium/canvaskit.wasm": "f504de372e31c8031018a9ec0a9ef5f0",
"canvaskit/canvaskit.js": "728b2d477d9b8c14593d4f9b82b484f3",
"canvaskit/canvaskit.wasm": "7a3f4ae7d65fc1de6a6e7ddd3224bc93"};
// The application shell files that are downloaded before a service worker can
// start.
const CORE = ["main.dart.js",
"main.dart.wasm",
"main.dart.mjs",
"index.html",
"flutter_bootstrap.js",
"assets/AssetManifest.bin.json",
"assets/FontManifest.json"];

// During install, the TEMP cache is populated with the application shell files.
self.addEventListener("install", (event) => {
  self.skipWaiting();
  return event.waitUntil(
    caches.open(TEMP).then((cache) => {
      return cache.addAll(
        CORE.map((value) => new Request(value, {'cache': 'reload'})));
    })
  );
});
// During activate, the cache is populated with the temp files downloaded in
// install. If this service worker is upgrading from one with a saved
// MANIFEST, then use this to retain unchanged resource files.
self.addEventListener("activate", function(event) {
  return event.waitUntil(async function() {
    try {
      var contentCache = await caches.open(CACHE_NAME);
      var tempCache = await caches.open(TEMP);
      var manifestCache = await caches.open(MANIFEST);
      var manifest = await manifestCache.match('manifest');
      // When there is no prior manifest, clear the entire cache.
      if (!manifest) {
        await caches.delete(CACHE_NAME);
        contentCache = await caches.open(CACHE_NAME);
        for (var request of await tempCache.keys()) {
          var response = await tempCache.match(request);
          await contentCache.put(request, response);
        }
        await caches.delete(TEMP);
        // Save the manifest to make future upgrades efficient.
        await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
        // Claim client to enable caching on first launch
        self.clients.claim();
        return;
      }
      var oldManifest = await manifest.json();
      var origin = self.location.origin;
      for (var request of await contentCache.keys()) {
        var key = request.url.substring(origin.length + 1);
        if (key == "") {
          key = "/";
        }
        // If a resource from the old manifest is not in the new cache, or if
        // the MD5 sum has changed, delete it. Otherwise the resource is left
        // in the cache and can be reused by the new service worker.
        if (!RESOURCES[key] || RESOURCES[key] != oldManifest[key]) {
          await contentCache.delete(request);
        }
      }
      // Populate the cache with the app shell TEMP files, potentially overwriting
      // cache files preserved above.
      for (var request of await tempCache.keys()) {
        var response = await tempCache.match(request);
        await contentCache.put(request, response);
      }
      await caches.delete(TEMP);
      // Save the manifest to make future upgrades efficient.
      await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
      // Claim client to enable caching on first launch
      self.clients.claim();
      return;
    } catch (err) {
      // On an unhandled exception the state of the cache cannot be guaranteed.
      console.error('Failed to upgrade service worker: ' + err);
      await caches.delete(CACHE_NAME);
      await caches.delete(TEMP);
      await caches.delete(MANIFEST);
    }
  }());
});
// The fetch handler redirects requests for RESOURCE files to the service
// worker cache.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  var origin = self.location.origin;
  var key = event.request.url.substring(origin.length + 1);
  // Redirect URLs to the index.html
  if (key.indexOf('?v=') != -1) {
    key = key.split('?v=')[0];
  }
  if (event.request.url == origin || event.request.url.startsWith(origin + '/#') || key == '') {
    key = '/';
  }
  // If the URL is not the RESOURCE list then return to signal that the
  // browser should take over.
  if (!RESOURCES[key]) {
    return;
  }
  // If the URL is the index.html, perform an online-first request.
  if (key == '/') {
    return onlineFirst(event);
  }
  event.respondWith(caches.open(CACHE_NAME)
    .then((cache) =>  {
      return cache.match(event.request).then((response) => {
        // Either respond with the cached resource, or perform a fetch and
        // lazily populate the cache only if the resource was successfully fetched.
        return response || fetch(event.request).then((response) => {
          if (response && Boolean(response.ok)) {
            cache.put(event.request, response.clone());
          }
          return response;
        });
      })
    })
  );
});
self.addEventListener('message', (event) => {
  // SkipWaiting can be used to immediately activate a waiting service worker.
  // This will also require a page refresh triggered by the main worker.
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
    return;
  }
  if (event.data === 'downloadOffline') {
    downloadOffline();
    return;
  }
});
// Download offline will check the RESOURCES for all files not in the cache
// and populate them.
async function downloadOffline() {
  var resources = [];
  var contentCache = await caches.open(CACHE_NAME);
  var currentContent = {};
  for (var request of await contentCache.keys()) {
    var key = request.url.substring(origin.length + 1);
    if (key == "") {
      key = "/";
    }
    currentContent[key] = true;
  }
  for (var resourceKey of Object.keys(RESOURCES)) {
    if (!currentContent[resourceKey]) {
      resources.push(resourceKey);
    }
  }
  return contentCache.addAll(resources);
}
// Attempt to download the resource online before falling back to
// the offline cache.
function onlineFirst(event) {
  return event.respondWith(
    fetch(event.request).then((response) => {
      return caches.open(CACHE_NAME).then((cache) => {
        cache.put(event.request, response.clone());
        return response;
      });
    }).catch((error) => {
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response != null) {
            return response;
          }
          throw error;
        });
      });
    })
  );
}
