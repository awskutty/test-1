/*
  @Decsription      : To handle redis db operations
  @Last Error Code  : 'ERR-REDIS-'
  @Last Modified    : Get Master redis cnnection if available 
*/

// Require dependencies
var reqRedis = require('redis');
var mRedisSessionValues = {};
var mRedisSessionValueswithIndex = {};
var serviceName = 'RedisInstance';

function createRedisInstance(callback, Index) {
    var reqInstanceHelper = require('../common/InstanceHelper');
    reqInstanceHelper.ReadConfigFile(async function (error, pConfig) {
        if (error) {
            return callback(error);
        } else {
            if (process.env.redis_master) {
                reqInstanceHelper.PrintInfo(serviceName, 'Master Redis available.Connecting to Master Redis', null);
                pConfig.RedisServer = JSON.parse(process.env.redis_master);
                pConfig.RedisServer.Password = new Buffer.from(pConfig.RedisServer.Password, 'base64').toString();
            }
            var strRedisServerPort = pConfig.RedisServer.Port;
            var strRedisServer = pConfig.RedisServer.Server;
            //var clientRedis = reqRedis.createClient(strRedisServerPort, strRedisServer);
            // var RedisConnRetryCount = 10;
            var clientRedis = reqRedis.createClient({
                socket: {
                    host: strRedisServer,
                    port: strRedisServerPort
                },
                password: pConfig.RedisServer.Password
            });

            if (Index) {
                var clientRediswithIndex = reqRedis.createClient({
                    socket: {
                        host: strRedisServer,
                        port: strRedisServerPort
                    },
                    password: pConfig.RedisServer.Password
                    // , retry_strategy: function (options) {
                    //     if (options.error && options.error.code == "ETIMEDOUT" || options.error.code === "ECONNREFUSED") {
                    //         console.log("The server refused the connection   ");
                    //     }
                    //     console.log(`Retry attempt options.attempt ${options.attempt}/${RedisConnRetryCount}`);
                    //     if (options.attempt > RedisConnRetryCount) {
                    //         console.log(' Redis retry attempt exhausted');
                    //         return undefined;
                    //     }
                    //     // reconnect after dely time
                    //     return 5000;
                    // }
                });

                await clientRediswithIndex.connect()
            }
            clientRedis.on("ready", function () {
                console.log("Connected to Redis server successfully");
            });

            clientRedis.on("error", function (err) {
                console.log("Redis server not reachable.Retry Redis connection" + err);
                // setTimeout(() => {
                //     createRedisInstance(callback, Index);
                // }, 3000);
            });

            await clientRedis.connect();
            if (Index) {
                clientRediswithIndex.select(Index)
                try {
                    mRedisSessionValueswithIndex['db' + Index] = {};
                    mRedisSessionValueswithIndex['db' + Index].Connection = clientRediswithIndex;
                    return callback(null, 'SUCCESS');
                } catch (error) {
                    console.log(error)
                }
                clientRediswithIndex.on("error", function () {
                    console.log("Redis server connection with index  not reachable.Retry Redis connection");
                    // createRedisInstance(callback, Index);
                });

            } else {
                mRedisSessionValues.Connection = clientRedis;
                return callback(null, 'SUCCESS');
            }
        }
    });
}

function getRedisConnection(callback) {
    if (mRedisSessionValues.Connection) {
        return callback(null, mRedisSessionValues.Connection);
    } else {
        createRedisInstance(function (error, result) {
            if (error) {
                return callback(error);
            } else {
                return callback(null, mRedisSessionValues.Connection);
            }
        });
    }
}

function getRedisConnectionwithIndex(Index, callback) {
    try {
        if (Index == '0') {
            getRedisConnection(callback)
        } else {
            console.log(' mRedisSessionValueswithIndex ' + Object.keys(mRedisSessionValueswithIndex))
            if (mRedisSessionValueswithIndex['db' + Index] && mRedisSessionValueswithIndex['db' + Index].Connection) {
                return callback(null, mRedisSessionValueswithIndex['db' + Index].Connection);
            } else {
                createRedisInstance(function (error, result) {
                    if (error) {
                        return callback(error);
                    } else {
                        return callback(null, mRedisSessionValueswithIndex['db' + Index].Connection);
                    }
                }, Index);
            }
        }

    } catch (error) {
        console.log('error ' + error)
        return callback(error, '');
    }
}

function disconnect(callback) {
    var reqInstanceHelper = require('../common/InstanceHelper');
    if (mRedisSessionValues.Connection) {
        mRedisSessionValues.Connection.quit();
        reqInstanceHelper.PrintInfo(serviceName, 'Redis.....Disconnected.', null);
        return callback();
    }
}
//Redis insert with TTL
function RedisInsert(Client, pkey, pValue, ttl) {
    // Client.set(pkey, JSON.stringify(pValue), 'EX', ttl);
    Client.set(pkey, JSON.stringify(pValue));
    Client.expire(pkey, ttl)
    return;
}

function getRedisDetail(callback) {
    var reqInstanceHelper = require('../common/InstanceHelper');
    reqInstanceHelper.ReadConfigFile(function (error, pConfig) {
        if (error) {
            return callback(error);
        } else {
            return callback(null, pConfig.RedisServer);
        }
    });
}


async function RedisSetNx(redisSession, pkey, objFileDetails, ttl, callback) {
    try {
        var res = await redisSession.set(pkey, objFileDetails, { EX: ttl, NX: true });
        callback(res)
    } catch (error) {
        callback("FAILURE - " + error)
    }
}

async function delRediskey(redissession, pkey, pcallback) {
    try {
        await redissession.del(pkey);
        pcallback('SUCCESS')
    } catch (error) {
        pcallback("Error delete rediskey - |" + error)
    }
}

// pRedisClient.keys('*', function (error, keys) {
function ListAllKeys(redisSession, objLogInfo) {
    return new Promise(async (resolve, result) => {
        var result = await redisSession.KEYS('*');
        resolve(result)
    })
}
function GetKeyValue(redisSession, pKey, objLogInfo) {
    return new Promise(async (resolve, result) => {
        var result = await redisSession.GET(pKey)
        resolve(result)
    })
}
function redisInsert(RedisSession, pkey, pvalue) {
    return new Promise(async (resolve, reject) => {
        try {
            // reqRedisInstance.RedisInsert(RedisSession, pkey, pvalue, -1)
            // var result = await RedisSession.set(pkey, JSON.stringify(pvalue))
            try {
                if (typeof (pvalue) == 'object' || JSON.parse(pvalue).length) {
                    pvalue = JSON.stringify(pvalue)
                }
            } catch (error) {

            }

            var result = await RedisSession.set(pkey, pvalue)
            resolve(result)
        } catch (error) {
            reject(error)
        }

    })
}
function getttl(RedisSession, pkey, objLogInfo) {
    return new Promise(async (resolve, reject) => {
        var result = await RedisSession.TTL(pkey)
        resolve(result)
    })
}
function RedisInsertWithTTL(RedisSession, pkey, pvalue, ttl) {
    return new Promise(async (resolve, reject) => {
        try {
            var result = await RedisSession.SETEX(pkey, ttl, JSON.stringify(pvalue))
            resolve(result)
        } catch (error) {
            reject(error)
        }
    })
}
module.exports = {
    CreateRedisInstance: createRedisInstance,
    GetRedisConnection: getRedisConnection,
    Disconnect: disconnect,
    RedisInsert: RedisInsert,
    GetRedisConnectionwithIndex: getRedisConnectionwithIndex,
    GetRedisDetail: getRedisDetail,
    RedisSetNx: RedisSetNx,
    delRediskey: delRediskey,
    ListAllKeys: ListAllKeys,
    GetKeyValue: GetKeyValue,
    redisInsert: redisInsert,
    getttl: getttl,
    RedisInsertWithTTL: RedisInsertWithTTL

};
/********* End of File *************/