import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Redis from 'ioredis';

vi.mock('ioredis');

describe('Redis Service', () => {
  let originalEnv;
  let redisModule;

  beforeEach(async () => {
    // Store original environment variables
    originalEnv = {
      REDIS_PASSWORD: process.env.REDIS_PASSWORD,
      REDIS_0_DNS: process.env.REDIS_0_DNS,
      REDIS_1_DNS: process.env.REDIS_1_DNS,
      REDIS_2_DNS: process.env.REDIS_2_DNS,
      REDIS_0_SENTINEL_PORT: process.env.REDIS_0_SENTINEL_PORT,
      REDIS_1_SENTINEL_PORT: process.env.REDIS_1_SENTINEL_PORT,
      REDIS_2_SENTINEL_PORT: process.env.REDIS_2_SENTINEL_PORT,
      REDIS_MASTER_NAME: process.env.REDIS_MASTER_NAME,
    };

    // Clear mocks
    Redis.mockClear();
    
    // Reset modules to get fresh instance
    vi.resetModules();
  });

  afterEach(() => {
    // Restore original environment variables
    Object.keys(originalEnv).forEach(key => {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    });
    
    vi.resetModules();
  });

  describe('Redis Connection Configuration', () => {
    it('should create Redis connection with default configuration', async () => {
      // Set up environment variables
      process.env.REDIS_PASSWORD = 'test-password';
      process.env.REDIS_0_DNS = 'redis-0.example.com';
      process.env.REDIS_1_DNS = 'redis-1.example.com';
      process.env.REDIS_2_DNS = 'redis-2.example.com';

      const mockRedisInstance = { 
        ping: vi.fn().mockResolvedValue('PONG'),
        get: vi.fn(),
        set: vi.fn()
      };
      Redis.mockImplementation(() => mockRedisInstance);

      // Import module after setting up environment
      redisModule = await import('../../src/redis.js');

      expect(Redis).toHaveBeenCalledWith({
        sentinelPassword: 'test-password',
        sentinels: [
          { host: 'redis-0.example.com', port: 26379 },
          { host: 'redis-1.example.com', port: 26379 },
          { host: 'redis-2.example.com', port: 26379 },
        ],
        name: 'mymaster',
        password: 'test-password',
      });
    });

    it('should use custom sentinel ports when provided', async () => {
      process.env.REDIS_PASSWORD = 'test-password';
      process.env.REDIS_0_DNS = 'redis-0.example.com';
      process.env.REDIS_1_DNS = 'redis-1.example.com';
      process.env.REDIS_2_DNS = 'redis-2.example.com';
      process.env.REDIS_0_SENTINEL_PORT = '26380';
      process.env.REDIS_1_SENTINEL_PORT = '26381';
      process.env.REDIS_2_SENTINEL_PORT = '26382';

      const mockRedisInstance = { 
        ping: vi.fn().mockResolvedValue('PONG'),
        get: vi.fn(),
        set: vi.fn()
      };
      Redis.mockImplementation(() => mockRedisInstance);

      redisModule = await import('../../src/redis.js');

      expect(Redis).toHaveBeenCalledWith({
        sentinelPassword: 'test-password',
        sentinels: [
          { host: 'redis-0.example.com', port: '26380' },
          { host: 'redis-1.example.com', port: '26381' },
          { host: 'redis-2.example.com', port: '26382' },
        ],
        name: 'mymaster',
        password: 'test-password',
      });
    });

    it('should use custom master name when provided', async () => {
      process.env.REDIS_PASSWORD = 'test-password';
      process.env.REDIS_0_DNS = 'redis-0.example.com';
      process.env.REDIS_1_DNS = 'redis-1.example.com';
      process.env.REDIS_2_DNS = 'redis-2.example.com';
      process.env.REDIS_MASTER_NAME = 'custom-master';

      const mockRedisInstance = { 
        ping: vi.fn().mockResolvedValue('PONG'),
        get: vi.fn(),
        set: vi.fn()
      };
      Redis.mockImplementation(() => mockRedisInstance);

      redisModule = await import('../../src/redis.js');

      expect(Redis).toHaveBeenCalledWith({
        sentinelPassword: 'test-password',
        sentinels: [
          { host: 'redis-0.example.com', port: 26379 },
          { host: 'redis-1.example.com', port: 26379 },
          { host: 'redis-2.example.com', port: 26379 },
        ],
        name: 'custom-master',
        password: 'test-password',
      });
    });

    it('should handle missing environment variables gracefully', async () => {
      // Don't set any environment variables
      delete process.env.REDIS_PASSWORD;
      delete process.env.REDIS_0_DNS;
      delete process.env.REDIS_1_DNS;
      delete process.env.REDIS_2_DNS;
      delete process.env.REDIS_MASTER_NAME;

      const mockRedisInstance = { 
        ping: vi.fn().mockResolvedValue('PONG'),
        get: vi.fn(),
        set: vi.fn()
      };
      Redis.mockImplementation(() => mockRedisInstance);

      redisModule = await import('../../src/redis.js');

      expect(Redis).toHaveBeenCalledWith({
        sentinelPassword: undefined,
        sentinels: [
          { host: 'undefined', port: 26379 },
          { host: 'undefined', port: 26379 },
          { host: 'undefined', port: 26379 },
        ],
        name: 'mymaster',
        password: undefined,
      });
    });
  });

  describe('Redis Instance', () => {
    beforeEach(async () => {
      process.env.REDIS_PASSWORD = 'test-password';
      process.env.REDIS_0_DNS = 'redis-0.example.com';
      process.env.REDIS_1_DNS = 'redis-1.example.com';
      process.env.REDIS_2_DNS = 'redis-2.example.com';
    });

    it('should export redis instance', async () => {
      const mockRedisInstance = { 
        ping: vi.fn().mockResolvedValue('PONG'),
        get: vi.fn(),
        set: vi.fn()
      };
      Redis.mockImplementation(() => mockRedisInstance);

      redisModule = await import('../../src/redis.js');

      expect(redisModule.redis).toBeDefined();
      expect(redisModule.redis).toBe(mockRedisInstance);
    });

    it('should be able to call redis methods', async () => {
      const mockRedisInstance = { 
        ping: vi.fn().mockResolvedValue('PONG'),
        get: vi.fn().mockResolvedValue('test-value'),
        set: vi.fn().mockResolvedValue('OK')
      };
      Redis.mockImplementation(() => mockRedisInstance);

      redisModule = await import('../../src/redis.js');

      // Test ping
      const pingResult = await redisModule.redis.ping();
      expect(pingResult).toBe('PONG');
      expect(mockRedisInstance.ping).toHaveBeenCalled();

      // Test get
      const getValue = await redisModule.redis.get('test-key');
      expect(getValue).toBe('test-value');
      expect(mockRedisInstance.get).toHaveBeenCalledWith('test-key');

      // Test set
      const setResult = await redisModule.redis.set('test-key', 'test-value');
      expect(setResult).toBe('OK');
      expect(mockRedisInstance.set).toHaveBeenCalledWith('test-key', 'test-value');
    });
  });
});
