// Test setup file for Vitest
import { beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';

// Clean up localStorage before each test
beforeEach(() => {
  // Clear localStorage
  localStorage.clear();
});

afterEach(() => {
  // Additional cleanup if needed
});
