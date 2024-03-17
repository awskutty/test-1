/*
  @Decsription      : To handle redis db operations
  @Last Error Code  : 'ERR-REF-230117'
*/

// Require dependencies
var reqRedis = require('redis');
var mRedisSessionValues = {};
var serviceName = 'CacheRedisInstance';
var reqEncryptionInstance = require('../common/crypto/EncryptionInstance');
var reqInstanceHelper = require('../common/InstanceHelper');
var arrConnectedServers = [];
var arrRetryingKeys = [];
var connString = 'CACHE_DB';
var defaultRoutingKey = 'clt-0~app-0~tnt-0~env-0';
var arrDoConnect = [];
var arrRetryingKeys = [];
var metaCacheProperties = {};

// this is for try connect redis in time interval in failure case
function doConnect(redisKey) {
    try {
        function callback(result) {
            try {
                if (result.status == 'SUCCESS') {
                    for (var i = 0; i < arrDoConnect.length; i++) {
                        var obj = arrDoConnect[i];
                        if (obj.redisKey == redisKey) {
                            clearInterval(obj.interval);
                            arrRetryingKeys.pop(redisKey);
                            arrDoConnect.pop(obj);
                            reqInstanceHelper.PrintInfo(serviceName, redisKey + ' Retry stoped.', null);
                            break;
                        }
                    }
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230064', 'Error in doConnect function', error);
            }
        }
        if (arrRetryingKeys.indexOf(redisKey, 0) > -1) {
            reqInstanceHelper.PrintInfo(serviceName, redisKey + ' Already Retrying.', null);
        } else {
            reqInstanceHelper.PrintInfo(serviceName, redisKey + ' Initiated Retrying.', null);
            var interval = setInterval(createInstancesOnRuntime, 15000, redisKey, callback);
            var obj = {};
            obj.redisKey = redisKey;
            obj.interval = interval;
            arrRetryingKeys.push(redisKey);
            arrDoConnect.push(obj);
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230065', 'Error in doConnect function', error);
    }
}

// this is for create redis instance
async function createRedisInstance(pRedisKey, pVal, pCallback) {
    try {
        var redisConf = pVal.Redis;
        var port = redisConf.Port;
        var host = redisConf.Host;
        var strPwd = reqEncryptionInstance.DoDecrypt(redisConf.Password.toLowerCase());
        var conn = {
            socket: {
                host: host,
                port: port
            },
            password: strPwd
        };
        var currentKey = '';
        for (var k = 0; k < arrConnectedServers.length; k++) {
            var item = arrConnectedServers[k];
            if (JSON.stringify(item.conn) == JSON.stringify(conn)) {
                currentKey = item.keyName;
                break;
            }
        }
        var result = {};
        if (currentKey != '') {
            mRedisSessionValues[pRedisKey.toUpperCase()] = mRedisSessionValues[currentKey.toUpperCase()];
        } else {
            var isDb0Done = false;
            var isDb1Done = false;
            var redis_db0 = reqRedis.createClient(conn);
            var redis_db1 = reqRedis.createClient(conn);

            // var redis_db1 = reqRedis.createClient(conn);
            var databases = {};
            var errorSent = false;
            // await redis_db0.connect();
            // await redis_db1.connect();
            redis_db0.on('error', function (error) {
                try {
                    if (error.code == 'NR_CLOSED') {
                        reqInstanceHelper.PrintError(serviceName, null, 'ERR-REF-230066', 'Error in createRedisInstance function', error);
                    } else {
                        reqInstanceHelper.PrintError(serviceName, null, 'ERR-REF-230067', 'Error in createRedisInstance function', error);
                        redis_db0.quit(); // for stop redis default retry
                        isDb0Done = true;
                        failureCall();
                    }
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, null, 'ERR-REF-230078', 'Error in Redis on error function', error);
                }
            });
            redis_db0.on('ready', async function () {
                try {
                    var reply = await redis_db0.select(0);
                    databases['db0'] = redis_db0;
                    isDb0Done = true;
                    successCall();
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, null, 'ERR-REF-230079', 'Error in Redis on ready function', error);
                }
            });
            await redis_db0.connect();
            redis_db1.on('error', function (error) {
                try {
                    if (error.code == 'NR_CLOSED') {
                        reqInstanceHelper.PrintError(serviceName, null, 'ERR-REF-230066', 'Error in createRedisInstance function', error);
                    } else {
                        reqInstanceHelper.PrintError(serviceName, null, 'ERR-REF-230067', 'Error in createRedisInstance function', error);
                        redis_db1.quit(); // for stop redis default retry
                        isDb1Done = true;
                        failureCall();
                    }
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, null, 'ERR-REF-230078', 'Error in Redis on error function', error);
                }
            });
            redis_db1.on('ready', async function () {
                try {
                    var reply = await redis_db1.select(1);
                    databases['db1'] = redis_db1;
                    isDb1Done = true;
                    successCall();
                    // redis_db1.select(1, function (error, reply) {
                    //     try {
                    //         if (error) {
                    //             reqInstanceHelper.PrintError(serviceName, null, 'errcode', 'Error in Redis on ready function', error);
                    //         } else {
                    //             databases['db1'] = redis_db1;
                    //             isDb1Done = true;
                    //             successCall();
                    //         }
                    //     } catch (error) {
                    //         reqInstanceHelper.PrintError(serviceName, null, 'errcode', 'Error in Redis on ready function', error);
                    //     }
                    // });
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, null, 'ERR-REF-230079', 'Error in Redis on ready function', error);
                }
            });
            await redis_db1.connect();
            function successCall() {
                if (isDb0Done && isDb1Done) {
                    pushConnectionToArray(pRedisKey.toUpperCase(), conn);
                    mRedisSessionValues[pRedisKey.toUpperCase()] = databases;
                    result.status = 'SUCCESS';
                    return pCallback(result);
                }
            }
            function failureCall() {
                if (isDb0Done && isDb1Done && !errorSent) {
                    errorSent = true;
                    doConnect(pRedisKey);
                    result.status = 'FAILURE';
                    return pCallback(result);
                }
            }
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, null, 'ERR-REF-230080', 'Error in Redis on ready function', error);
    }
}

// this is for add connection to memory
function pushConnectionToArray(pKey, pConn) {
    try {
        var obj = {};
        obj.keyName = pKey;
        obj.conn = pConn;
        arrConnectedServers.push(obj);
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, null, 'ERR-REF-230068', 'Error in pushConnectionToArray function', error);
    }
}

// this is for create redis instances on runtime
function createInstancesOnRuntime(pRedisKey, callback) {
    try {
        reqInstanceHelper.GetConfig(pRedisKey, function (pConf) {
            try {
                if (pConf) {
                    var objResult = JSON.parse(pConf);
                    createRedisInstance(pRedisKey, objResult, function (pResult) {
                        try {
                            return callback(pResult);
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, null, 'ERR-REF-230069', 'Error in createInstancesOnRuntime function', error);
                        }
                    });
                } else {
                    return callback({ status: 'FAILURE' });
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, null, 'ERR-REF-230070', 'Error in createInstancesOnRuntime function', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, null, 'ERR-REF-230071', 'Error in createInstancesOnRuntime function', error);
    }
}

// this is for retrive redis connection from memory
function getRedisConnection(pHeaders, pCallback) {
    try {
        reqInstanceHelper.PrintInfo(serviceName, 'GetRedisConnection Begin', null);
        var redisClient = null;
        if (!pHeaders) {
            pHeaders = {};
        }
        reqInstanceHelper.PrintInfo(serviceName, 'routingkey ==== ' + pHeaders['routingkey'], null);
        reqInstanceHelper.GetRedisKey(connString, pHeaders['routingkey'], function (redisKey) {
            try {
                reqInstanceHelper.PrintInfo(serviceName, 'Finding redisKey ==== ' + redisKey, null);
                var keySpaceValues;
                reqInstanceHelper.IsRedisKeyAvail(redisKey, function (result) {
                    try {
                        if (result) {
                            if (mRedisSessionValues[redisKey]) {
                                reqInstanceHelper.PrintInfo(serviceName, 'Redis key available', null);
                                redisClient = mRedisSessionValues[redisKey];
                                return sendResult(redisClient);
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'New Redis creation', null);
                                if (arrRetryingKeys.indexOf(redisKey, 0) > -1) {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Already Retrying');
                                    return sendResult(null);
                                } else {
                                    createInstancesOnRuntime(redisKey, function (pResult) {
                                        try {
                                            if (pResult.status == 'SUCCESS') {
                                                redisClient = mRedisSessionValues[redisKey];
                                                return sendResult(redisClient);
                                            }
                                        } catch (error) {
                                            reqInstanceHelper.PrintError(serviceName, null, 'ERR-REF-230072', 'Error in createInstancesOnRuntime callback', error);
                                        }
                                    });
                                }
                            }
                        } else {
                            reqInstanceHelper.PrintInfo(serviceName, 'Accessing default Redis', null);
                            redisClient = mRedisSessionValues[(connString + '~' + defaultRoutingKey).toUpperCase()];
                            if (redisClient) {
                                reqInstanceHelper.PrintInfo(serviceName, 'Default Redis available', null);
                                return sendResult(redisClient);
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'Connecting default Redis', null);
                                var defaultRedisKey = (connString + '~' + defaultRoutingKey).toUpperCase();
                                reqInstanceHelper.IsRedisKeyAvail(defaultRedisKey, function (result) {
                                    if (result) {
                                        if (arrRetryingKeys.indexOf(defaultRedisKey, 0) > -1) {
                                            reqInstanceHelper.PrintInfo(serviceName, 'Already Retrying');
                                            return sendResult(null);
                                        } else {
                                            createInstancesOnRuntime(defaultRedisKey, function (pResult) {
                                                try {
                                                    if (pResult.status == 'SUCCESS') {
                                                        redisClient = mRedisSessionValues[redisKey];
                                                        return sendResult(redisClient);
                                                    }
                                                } catch (error) {
                                                    reqInstanceHelper.PrintError(serviceName, null, 'ERR-REF-230073', 'Error in createInstancesOnRuntime callback', error);
                                                }
                                            });
                                        }
                                    } else {
                                        reqInstanceHelper.PrintInfo(serviceName, defaultRedisKey, 'Key Not Avalable');
                                        return sendResult(null);
                                    }
                                });
                            }
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, null, 'ERR-REF-230074', 'Error in reqInstanceHelper.IsRedisKeyAvail callback', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, null, 'ERR-REF-230075', 'Error in reqInstanceHelper.GetRedisKey callback', error);
            }
        });

        function sendResult(result) {
            reqInstanceHelper.PrintInfo(serviceName, 'GetRedisConnection End', null);
            return pCallback(result);
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, null, 'ERR-REF-230076', 'Error in GetRedisConnection function', error);
    }
}

// this is for disconnect all redis instances
function disconnect(callback) {
    try {
        var i = 0;
        if (arrConnectedServers.length) {
            doDisconnect(arrConnectedServers[i].keyName);
        } else {
            mRedisSessionValues = {};
            arrConnectedServers = [];
            return callback();
        }
        function doDisconnect(currentKey) {
            try {
                i++;
                mRedisSessionValues[currentKey]['db0'].quit();
                mRedisSessionValues[currentKey]['db1'].quit();
                reqInstanceHelper.PrintInfo(serviceName, currentKey + '_db' + dbindex + '.....Disconnected.', null);
                if (i < arrConnectedServers.length) {
                    doDisconnect(arrConnectedServers[i].keyName);
                } else {
                    mRedisSessionValues = {};
                    arrConnectedServers = [];
                    return callback();
                }
            } catch (error) {
                return callback(error);
            }
        }
    } catch (error) {
        return callback(error);
    }
}

// this is for add key val to redis with expiry time
function setKeyValWithExpiry(pClient, objLogInfo, pKey, pVal, pExpireMin, callback) {
    try {
        if (pClient) {
            var expSec = pExpireMin * 60;
            pClient.setex(pKey, expSec, pVal, function (error, result) {
                try {
                    callback(error, result);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230083', 'Error in setKeyValWithExpiry', error);
                }
            });
        } else {
            return callback('Key not exist');
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230084', 'Error in setKeyValWithExpiry', error);
    }
}

// this is for retrive val from redis
function getKeyVal(pClient, objLogInfo, pKey, callback) {
    try {
        if (pClient) {
            pClient.exists(pKey, function (err, reply) {
                try {
                    if (err) {
                        return callback(err);
                    } else {
                        if (reply === 1) {
                            pClient.get(pKey, function (err, reply) {
                                try {
                                    return callback(err, reply.toString());
                                } catch (error) {
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230077', 'Error in getRedisValue function', error);
                                }
                            });
                        } else {
                            return callback('Key not exist');
                        }
                    }
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230085', 'Error in getRedisValue', error);
                }
            });
        } else {
            return callback('Key not exist');
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230086', 'Error in getRedisValue', error);
    }
}

// this is for add cache properties to memory
function setCacheProperties(headers, objLogInfo, callback) {
    try {
        var reqDBInstance = require('./DBInstance');
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        var reqsvchelper = require('../common/serviceHelper/ServiceHelper');
        reqDBInstance.GetFXDBConnection(headers, 'clt_cas', objLogInfo, function (cltClient) {
            try {
                var routingkey = headers.routingkey;
                var arrKey = routingkey.split('~');
                var clientId = arrKey[0].split('-')[1];
                var appId = arrKey[1].split('-')[1];
                var tenantId = arrKey[2].split('-')[1];
                var isFramework = 'N';

                if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                    var cond = {};
                    cond.setup_code = 'CACHE_PROPERTIES';
                    reqsvchelper.GetSetupJson(cltClient, cond, objLogInfo, function (res) {
                        if (res.Status == 'SUCCESS' && res.Data.length) {
                            metaCacheProperties[routingkey] = JSON.parse(res.Data[0].setup_json).META_DATA_CACHE;
                            return callback('SUCCESS');
                        } else {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230081', res.ErrorMsg, res.Error);
                            return callback('FAILURE');
                        }
                    });
                } else {
                    reqDBInstance.GetTableFromFXDB(cltClient, 'tenant_setup', ['setup_json'], { client_id: clientId, tenant_id: tenantId, category: 'CACHE_PROPERTIES' }, objLogInfo, function (error, result) {
                        try {
                            if (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230088', 'errmsg', error);
                                return callback('FAILURE');
                            } else {
                                if (result.rows.length && JSON.parse(result.rows[0].setup_json).META_DATA_CACHE) {
                                    metaCacheProperties[routingkey] = JSON.parse(result.rows[0].setup_json).META_DATA_CACHE;
                                    return callback('SUCCESS');
                                } else {
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230089', 'Problem in tenant_setup table CACHE_PROPERTIES', error);
                                    return callback('FAILURE');
                                }
                            }
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230090', 'errmsg', error);
                        }
                    });
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230091', 'errmsg', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230092', 'errmsg', error);
    }
}

// this is for retrive cache properties from memory
function getCacheProperties(headers, objLogInfo, callback) {
    try {
        var routingkey = headers.routingkey;
        if (routingkey) {
            if (metaCacheProperties[routingkey]) {
                return callback(metaCacheProperties[routingkey]);
            } else {
                setCacheProperties(headers, objLogInfo, function (result) {
                    try {
                        if (result == 'SUCCESS') {
                            return callback(metaCacheProperties[routingkey]);
                        } else {
                            return callback(null);
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230093', 'errmsg', error);
                    }
                });
            }
        } else {
            return callback(null);
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230094', 'errmsg', error);
    }
}

// this is for add cache data to redis
function addCacheToRedis(headers, params, objLogInfo, callback) {
    try {
        if (params.expirMin === -1) {
            delete params.expirMin;
        }
        reqInstanceHelper.PrintInfo(serviceName, 'adding key' + params.uniquKey, objLogInfo);
        var db = params.db ? params.db : 'db0';
        var uniquKey = params.uniquKey;
        var value = params.value;
        var expirMin = params.expirMin;
        getRedisConnection(headers, async function (redisClient) {
            try {
                if (redisClient) {
                    var redisDB = redisClient[db];
                    if (expirMin) {
                        var expSec = expirMin * 60;
                        // redisDB.setex(uniquKey, expSec, value, function (error, result) {
                        try {
                            await redisDB.setex(uniquKey, expSec, value)
                            return callback('SUCCESS');
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230097', 'errmsg', error);
                        }
                        // });
                    } else {
                        await redisDB.set(uniquKey, value)
                        return callback('SUCCESS');
                    }

                } else {
                    return callback('FAILURE');
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230101', 'errmsg', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230102', 'errmsg', error);
    }
}

// this is for retrive cache data from redis
function getCacheFromRedis(headers, params, objLogInfo, callback) {
    try {
        var db = params.db ? params.db : 'db0';
        var uniquKey = params.uniquKey;
        getRedisConnection(headers, async function (redisClient) {
            try {
                if (redisClient) {
                    var redisDB = redisClient[db];
                    // redisDB.exists(uniquKey, function (error, reply) {
                    var reply = await redisDB.exists(uniquKey)
                    try {
                        if (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230104', 'errmsg', error);
                            return callback(null);
                        } else {
                            if (reply === 1) {
                                reply = await redisDB.exists(uniquKey)
                                return callback(reply.toString());
                            } else {
                                return callback(null);
                            }
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230107', 'errmsg', error);
                    }
                    // });
                } else {
                    return callback(null);
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230109', 'errmsg', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230110', 'errmsg', error);
    }
}

function clearCache(headers, params, objLogInfo, callback) {
    try {
        var db = params.db ? params.db : 'db0';
        var clearAll = params.clearAll ? params.clearAll : false;
        getRedisConnection(headers, async function (redisClient) {
            try {
                if (redisClient) {
                    var redisDB = redisClient[db];
                    if (clearAll) {
                        var reply = await redisDB.flushAll();
                        console.log(reply)
                        return callback('SUCCESS');
                    } else if (params.selectedKeys && params.selectedKeys.length) {

                        var reply = await redisDB.DEL(params.selectedKeys);
                        console.log(reply)
                        return callback('SUCCESS');
                    } else if (db) {
                        redisDB = redisClient[db];
                        var reply = await redisDB.flushDb();
                        console.log(reply);
                        return callback('SUCCESS');
                    } else {
                        return callback('FAILURE');
                    }
                } else {
                    return callback('FAILURE');
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230116', 'errmsg', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230117', 'errmsg', error);
    }
}

module.exports = {
    CreateRedisInstance: createRedisInstance,
    GetRedisConnection: getRedisConnection,
    Disconnect: disconnect,
    //SetKeyValWithExpiry: setKeyValWithExpiry,
    //GetKeyVal: getKeyVal,
    GetCacheProperties: getCacheProperties,
    GetCacheFromRedis: getCacheFromRedis,
    AddCacheToRedis: addCacheToRedis,
    ClearCache: clearCache
};
/********* End of File *************/