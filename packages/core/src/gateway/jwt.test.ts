/*
 * Copyright 2025, Salesforce, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { JSONWebToken, type Header, type Payload } from './jwt.js';

describe('JSONWebToken', () => {
  let mockDateNow: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock Date.now() to return a consistent timestamp for testing
    mockDateNow = vi.fn().mockReturnValue(1640995200000); // 2022-01-01 00:00:00 UTC
    vi.stubGlobal('Date', {
      ...Date,
      now: mockDateNow,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create a JWT instance with valid response', () => {
      const header: Header = { tnk: 'test-tenant' };
      const payload: Payload = { exp: 1640998800, sfap_op: 'test-operation' }; // 1 hour from mock time

      // Create a properly formatted JWT token
      const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
        'base64',
      );
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64',
      );
      const mockJwt = `${headerBase64}.${payloadBase64}.signature`;

      const jwt = new JSONWebToken({ jwt: mockJwt });

      expect(jwt.serializedJWT).toBe(mockJwt);
      expect(jwt.header).toEqual(header);
      expect(jwt.payload).toEqual(payload);
      expect(jwt.exp).toBe(1640998800000 - 30000); // Converted to ms with 30s buffer
    });

    it('should create a JWT instance with custom expiration', () => {
      const header: Header = { tnk: 'test-tenant' };
      const payload: Payload = { exp: 1640998800, sfap_op: 'test-operation' };

      const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
        'base64',
      );
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64',
      );
      const mockJwt = `${headerBase64}.${payloadBase64}.signature`;

      const customExp = 1700000000000;
      const jwt = new JSONWebToken({ jwt: mockJwt }, customExp);

      expect(jwt.exp).toBe(customExp);
    });

    it('should throw error when JWT is missing', () => {
      expect(() => {
        new JSONWebToken({ jwt: '' });
      }).toThrow('Invalid JWT response');
    });

    it('should throw error when JWT is undefined', () => {
      expect(() => {
        // @ts-expect-error Testing invalid input
        new JSONWebToken({});
      }).toThrow('Invalid JWT response');
    });

    it('should throw error when JWT format is invalid (missing payload)', () => {
      const mockJwt = 'invalid.jwt.format';

      expect(() => {
        new JSONWebToken({ jwt: mockJwt });
      }).toThrow(); // Just expect any error since base64 decoding will fail
    });

    it('should throw error when JWT has only one part', () => {
      const mockJwt = 'onlyonepart';

      expect(() => {
        new JSONWebToken({ jwt: mockJwt });
      }).toThrow('Unable to split JWT token');
    });

    it('should handle JWT with malformed base64 encoding', () => {
      const mockJwt = 'invalid-base64.invalid-base64.signature';

      expect(() => {
        new JSONWebToken({ jwt: mockJwt });
      }).toThrow();
    });

    it('should handle JWT with invalid JSON in payload', () => {
      const headerBase64 = Buffer.from(
        JSON.stringify({ tnk: 'test' }),
      ).toString('base64');
      const invalidJsonBase64 = Buffer.from('invalid-json').toString('base64');
      const mockJwt = `${headerBase64}.${invalidJsonBase64}.signature`;

      expect(() => {
        new JSONWebToken({ jwt: mockJwt });
      }).toThrow();
    });
  });

  describe('value', () => {
    it('should return the serialized JWT', () => {
      const header: Header = { tnk: 'test-tenant' };
      const payload: Payload = { exp: 1640998800, sfap_op: 'test-operation' };

      const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
        'base64',
      );
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64',
      );
      const mockJwt = `${headerBase64}.${payloadBase64}.signature`;

      const jwt = new JSONWebToken({ jwt: mockJwt });

      expect(jwt.value()).toBe(mockJwt);
    });
  });

  describe('isExpired', () => {
    it('should return false when token is not expired', () => {
      const header: Header = { tnk: 'test-tenant' };
      const payload: Payload = { exp: 1640998800, sfap_op: 'test-operation' }; // 1 hour from mock time

      const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
        'base64',
      );
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64',
      );
      const mockJwt = `${headerBase64}.${payloadBase64}.signature`;

      const jwt = new JSONWebToken({ jwt: mockJwt });

      expect(jwt.isExpired()).toBe(false);
    });

    it('should return true when token is expired', () => {
      const header: Header = { tnk: 'test-tenant' };
      const payload: Payload = { exp: 1640991600, sfap_op: 'test-operation' }; // 1 hour before mock time

      const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
        'base64',
      );
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64',
      );
      const mockJwt = `${headerBase64}.${payloadBase64}.signature`;

      const jwt = new JSONWebToken({ jwt: mockJwt });

      expect(jwt.isExpired()).toBe(true);
    });

    it('should return true when token expires exactly at current time', () => {
      const header: Header = { tnk: 'test-tenant' };
      const payload: Payload = { exp: 1640995200, sfap_op: 'test-operation' }; // Exactly at mock time

      const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
        'base64',
      );
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64',
      );
      const mockJwt = `${headerBase64}.${payloadBase64}.signature`;

      const jwt = new JSONWebToken({ jwt: mockJwt });

      // Since we subtract 30s buffer, it should be expired
      expect(jwt.isExpired()).toBe(true);
    });

    it('should return false when exp is 0 (edge case)', () => {
      const header: Header = { tnk: 'test-tenant' };
      const payload: Payload = { exp: 1640998800, sfap_op: 'test-operation' };

      const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
        'base64',
      );
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64',
      );
      const mockJwt = `${headerBase64}.${payloadBase64}.signature`;

      const jwt = new JSONWebToken({ jwt: mockJwt }, 0);

      expect(jwt.isExpired()).toBe(false);
    });

    it('should handle current time changes dynamically', () => {
      const header: Header = { tnk: 'test-tenant' };
      const payload: Payload = { exp: 1640998800, sfap_op: 'test-operation' };

      const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
        'base64',
      );
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64',
      );
      const mockJwt = `${headerBase64}.${payloadBase64}.signature`;

      const jwt = new JSONWebToken({ jwt: mockJwt });

      // Token should not be expired initially
      expect(jwt.isExpired()).toBe(false);

      // Fast forward time to after expiration
      mockDateNow.mockReturnValue(1641002000000); // 2 hours later

      // Token should now be expired
      expect(jwt.isExpired()).toBe(true);
    });
  });

  describe('tnk', () => {
    it('should return the tenant identifier from header', () => {
      const header: Header = { tnk: 'test-tenant-123' };
      const payload: Payload = { exp: 1640998800, sfap_op: 'test-operation' };

      const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
        'base64',
      );
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64',
      );
      const mockJwt = `${headerBase64}.${payloadBase64}.signature`;

      const jwt = new JSONWebToken({ jwt: mockJwt });

      expect(jwt.tnk()).toBe('test-tenant-123');
    });

    it('should return empty string when tnk is empty', () => {
      const header: Header = { tnk: '' };
      const payload: Payload = { exp: 1640998800, sfap_op: 'test-operation' };

      const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
        'base64',
      );
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64',
      );
      const mockJwt = `${headerBase64}.${payloadBase64}.signature`;

      const jwt = new JSONWebToken({ jwt: mockJwt });

      expect(jwt.tnk()).toBe('');
    });
  });

  describe('sfapOp', () => {
    it('should return the SFAP operation from payload', () => {
      const header: Header = { tnk: 'test-tenant' };
      const payload: Payload = {
        exp: 1640998800,
        sfap_op: 'custom-operation-xyz',
      };

      const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
        'base64',
      );
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64',
      );
      const mockJwt = `${headerBase64}.${payloadBase64}.signature`;

      const jwt = new JSONWebToken({ jwt: mockJwt });

      expect(jwt.sfapOp()).toBe('custom-operation-xyz');
    });

    it('should return empty string when sfap_op is empty', () => {
      const header: Header = { tnk: 'test-tenant' };
      const payload: Payload = { exp: 1640998800, sfap_op: '' };

      const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
        'base64',
      );
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64',
      );
      const mockJwt = `${headerBase64}.${payloadBase64}.signature`;

      const jwt = new JSONWebToken({ jwt: mockJwt });

      expect(jwt.sfapOp()).toBe('');
    });
  });

  describe('private methods integration', () => {
    it('should properly convert Unix timestamp to Date timestamp', () => {
      const header: Header = { tnk: 'test-tenant' };
      const unixTimestamp = 1640995200; // Unix timestamp in seconds
      const payload: Payload = {
        exp: unixTimestamp,
        sfap_op: 'test-operation',
      };

      const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
        'base64',
      );
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64',
      );
      const mockJwt = `${headerBase64}.${payloadBase64}.signature`;

      const jwt = new JSONWebToken({ jwt: mockJwt });

      // Should convert to milliseconds and subtract 30s buffer
      const expectedExp = unixTimestamp * 1000 - 30000;
      expect(jwt.exp).toBe(expectedExp);
    });

    it('should apply 30-second buffer correctly', () => {
      const header: Header = { tnk: 'test-tenant' };
      const payload: Payload = { exp: 1640995230, sfap_op: 'test-operation' }; // 30 seconds from mock time

      const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
        'base64',
      );
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64',
      );
      const mockJwt = `${headerBase64}.${payloadBase64}.signature`;

      const jwt = new JSONWebToken({ jwt: mockJwt });

      // With 30s buffer, should expire at exactly mock time
      expect(jwt.exp).toBe(1640995200000); // Mock time
      expect(jwt.isExpired()).toBe(false); // Current time equals exp, so not expired yet (uses > not >=)
    });

    it('should handle large expiration timestamps', () => {
      const header: Header = { tnk: 'test-tenant' };
      const payload: Payload = { exp: 2147483647, sfap_op: 'test-operation' }; // Max 32-bit integer

      const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
        'base64',
      );
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64',
      );
      const mockJwt = `${headerBase64}.${payloadBase64}.signature`;

      const jwt = new JSONWebToken({ jwt: mockJwt });

      expect(jwt.exp).toBe(2147483647 * 1000 - 30000);
      expect(jwt.isExpired()).toBe(false);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle JWT with additional parts (standard JWT format)', () => {
      const header: Header = { tnk: 'test-tenant' };
      const payload: Payload = { exp: 1640998800, sfap_op: 'test-operation' };

      const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
        'base64',
      );
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64',
      );
      const mockJwt = `${headerBase64}.${payloadBase64}.validSignature`;

      const jwt = new JSONWebToken({ jwt: mockJwt });

      expect(jwt.value()).toBe(mockJwt);
      expect(jwt.tnk()).toBe('test-tenant');
      expect(jwt.sfapOp()).toBe('test-operation');
    });

    it('should handle special characters in tnk and sfap_op', () => {
      const header: Header = { tnk: 'tenant-with-special-chars_123!@#' };
      const payload: Payload = {
        exp: 1640998800,
        sfap_op: 'operation/with:special@chars',
      };

      const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
        'base64',
      );
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64',
      );
      const mockJwt = `${headerBase64}.${payloadBase64}.signature`;

      const jwt = new JSONWebToken({ jwt: mockJwt });

      expect(jwt.tnk()).toBe('tenant-with-special-chars_123!@#');
      expect(jwt.sfapOp()).toBe('operation/with:special@chars');
    });

    it('should handle Unicode characters in tnk and sfap_op', () => {
      const header: Header = { tnk: 'tenant-测试-🔑' };
      const payload: Payload = {
        exp: 1640998800,
        sfap_op: 'operation-操作-🚀',
      };

      const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
        'base64',
      );
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64',
      );
      const mockJwt = `${headerBase64}.${payloadBase64}.signature`;

      const jwt = new JSONWebToken({ jwt: mockJwt });

      expect(jwt.tnk()).toBe('tenant-测试-🔑');
      expect(jwt.sfapOp()).toBe('operation-操作-🚀');
    });

    it('should handle very long JWT tokens', () => {
      const longString = 'a'.repeat(1000);
      const header: Header = { tnk: longString };
      const payload: Payload = { exp: 1640998800, sfap_op: longString };

      const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
        'base64',
      );
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64',
      );
      const mockJwt = `${headerBase64}.${payloadBase64}.signature`;

      const jwt = new JSONWebToken({ jwt: mockJwt });

      expect(jwt.tnk()).toBe(longString);
      expect(jwt.sfapOp()).toBe(longString);
    });

    it('should handle null values in header and payload gracefully', () => {
      const header = { tnk: null as unknown as string };
      const payload = { exp: 1640998800, sfap_op: null as unknown as string };

      const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
        'base64',
      );
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64',
      );
      const mockJwt = `${headerBase64}.${payloadBase64}.signature`;

      const jwt = new JSONWebToken({ jwt: mockJwt });

      expect(jwt.tnk()).toBe(null);
      expect(jwt.sfapOp()).toBe(null);
    });
  });

  describe('integration scenarios', () => {
    it('should work correctly in typical usage scenario', () => {
      // Simulate real JWT structure
      const header: Header = { tnk: 'prod-tenant-12345' };
      const payload: Payload = {
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
        sfap_op: 'llm-gateway-access',
      };

      const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
        'base64',
      );
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64',
      );
      const mockJwt = `${headerBase64}.${payloadBase64}.real-signature-hash`;

      const jwt = new JSONWebToken({ jwt: mockJwt });

      // Verify all methods work together
      expect(jwt.value()).toBe(mockJwt);
      expect(jwt.isExpired()).toBe(false);
      expect(jwt.tnk()).toBe('prod-tenant-12345');
      expect(jwt.sfapOp()).toBe('llm-gateway-access');

      // Verify expiration calculation
      const expectedExp = payload.exp * 1000 - 30000;
      expect(jwt.exp).toBe(expectedExp);
    });

    it('should handle rapid successive calls correctly', () => {
      const header: Header = { tnk: 'test-tenant' };
      const payload: Payload = { exp: 1640998800, sfap_op: 'test-operation' };

      const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
        'base64',
      );
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64',
      );
      const mockJwt = `${headerBase64}.${payloadBase64}.signature`;

      const jwt = new JSONWebToken({ jwt: mockJwt });

      // Multiple rapid calls should return consistent results
      for (let i = 0; i < 100; i++) {
        expect(jwt.value()).toBe(mockJwt);
        expect(jwt.tnk()).toBe('test-tenant');
        expect(jwt.sfapOp()).toBe('test-operation');
      }
    });

    it('should handle time changes during JWT lifetime', () => {
      const header: Header = { tnk: 'test-tenant' };
      const payload: Payload = { exp: 1640996400, sfap_op: 'test-operation' }; // 20 minutes from mock time

      const headerBase64 = Buffer.from(JSON.stringify(header)).toString(
        'base64',
      );
      const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString(
        'base64',
      );
      const mockJwt = `${headerBase64}.${payloadBase64}.signature`;

      const jwt = new JSONWebToken({ jwt: mockJwt });

      // Initially not expired
      expect(jwt.isExpired()).toBe(false);

      // Move time forward but still within validity
      mockDateNow.mockReturnValue(1640995800000); // 10 minutes later
      expect(jwt.isExpired()).toBe(false);

      // Move time to exactly expiration time (minus buffer)
      mockDateNow.mockReturnValue(1640996370000); // 19.5 minutes later (exactly at exp - 30s)
      expect(jwt.isExpired()).toBe(false); // Equal time means not expired (uses > not >=)

      // Move time just past expiration time (minus buffer)
      mockDateNow.mockReturnValue(1640996371000); // Just 1 second past exp - 30s
      expect(jwt.isExpired()).toBe(true);

      // Move time past expiration
      mockDateNow.mockReturnValue(1640996500000); // 21.67 minutes later
      expect(jwt.isExpired()).toBe(true);
    });
  });
});
