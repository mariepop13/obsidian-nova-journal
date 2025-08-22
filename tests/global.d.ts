/**
 * Global TypeScript declarations for test environment
 * This file extends the global namespace with test-specific properties
 * to avoid 'any' type assertions in test files.
 */

declare global {
  /**
   * Test-specific global variables for controlling mock behavior
   */
  namespace NodeJS {
    interface Global {
      /** Controls whether the mocked requestUrl should fail for testing error handling */
      _mockRequestUrlShouldFail?: boolean;
      /** Node.js process object that can be manipulated in tests - made optional for deletion */
      process?: NodeJS.Process | Record<string, unknown>;
    }
  }
  
  /**
   * Direct global namespace extension for test environment
   */
  var _mockRequestUrlShouldFail: boolean;
  
  /**
   * Extended process type that allows for test manipulation - made optional for deletion
   */
  var process: NodeJS.Process | Record<string, unknown> | undefined;
}

export {};
