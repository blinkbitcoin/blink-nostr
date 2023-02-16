import Redis from "ioredis"

const connectionObj = {
    sentinelPassword: process.env.REDIS_PASSWORD,
    sentinels: [
      {
        host: `${process.env.REDIS_0_DNS}`,
        port: process.env.REDIS_0_SENTINEL_PORT || 26379,
      },
      {
        host: `${process.env.REDIS_1_DNS}`,
        port: process.env.REDIS_1_SENTINEL_PORT || 26379,
      },
      {
        host: `${process.env.REDIS_2_DNS}`,
        port: process.env.REDIS_2_SENTINEL_PORT || 26379,
      },
    ],
    name: process.env.REDIS_MASTER_NAME ?? "mymaster",
    password: process.env.REDIS_PASSWORD,
  }
  
export const redis = new Redis(connectionObj)
  