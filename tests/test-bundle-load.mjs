// Mock browser environment to test bundle execution
import fs from 'fs';

globalThis.window = {
  location: { pathname: '/login', search: '', hash: '', href: 'http://localhost:4000/login' },
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
  history: { pushState: () => {}, replaceState: () => {} },
  localStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  },
};
globalThis.document = {
  title: '',
  getElementById: (id) => ({
    appendChild: () => {},
    setAttribute: () => {},
  }),
  querySelectorAll: () => [],
  querySelector: () => null,
  documentElement: {
    setAttribute: () => {},
    getAttribute: () => null,
    style: {},
    classList: { add: () => {}, remove: () => {} },
  },
  body: {
    appendChild: () => {},
    setAttribute: () => {},
    style: {},
    classList: { add: () => {}, remove: () => {} },
  },
  createElement: () => ({
    setAttribute: () => {},
    style: {},
  }),
  addEventListener: () => {},
  removeEventListener: () => {},
};
globalThis.localStorage = globalThis.window.localStorage;
try {
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'node' },
    configurable: true,
    writable: true,
  });
} catch (e) {}
globalThis.MutationObserver = class {
  observe() {}
  disconnect() {}
};
globalThis.EventSource = class {
  addEventListener() {}
  removeEventListener() {}
  close() {}
};

console.log('Testing bundle import...');
try {
  const bundle = fs.readdirSync('dist/assets').find(f => f.endsWith('.js'));
  console.log('Found bundle:', bundle);
  await import('../dist/assets/' + bundle);
  console.log('Bundle loaded successfully without top-level syntax or initialization error!');
} catch (err) {
  console.error('ERROR during bundle execution:', err);
}
