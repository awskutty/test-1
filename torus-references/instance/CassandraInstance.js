/*
  @Decsription: To process cassandra related functions
*/

// Require dependencies
var cassandra = require('cassandra-driver');
var reqEncryptionInstance = require('../common/crypto/EncryptionInstance');
var reqInstanceHelper = require('../common/InstanceHelper');
var reqCassandraHelper = require('./db/CassandraHelper');

// Initialize variables
var defaultRoutingKey = 'clt-0~app-0~tnt-0~env-0';
var connString = 'CASSANDRA';
var cassandraSessionValues = {};
var arrConnectedServers = [];
var serviceName = 'CassandraInstance';
var objLogInfo = null;

// To create cassandra instance for given redis key, add it to list
function createCassandraInstance(pRedisKey, pVal, pCallback, pKeySpace) {
    try {
        if (pVal != '') {
            var casServers = pVal.CassandraServers;
            var keySpaceValues = {};
            var i = 0;
            createNewCassServer(casServers[i]);

            function createNewCassServer(cassServer) {
                try {
                    var strEncPwd = reqEncryptionInstance.DoDecrypt(cassServer.Password.toLowerCase());
                    var auth = new cassandra.auth.PlainTextAuthProvider(cassServer.UserName, strEncPwd);
                    var server = [cassServer.Server];
                    var port = cassServer.Port;
                    var casKeySpaces = cassServer.CassandraKeySpaces;
                    if (pKeySpace) {
                        var newCasKeySpaces = [];
                        for (var k = 0; k < casKeySpaces.length; k++) {
                            var currentKeySpace = casKeySpaces[k];
                            if (currentKeySpace.Code == pKeySpace) {
                                newCasKeySpaces.push(currentKeySpace);
                            }
                        }
                        casKeySpaces = newCasKeySpaces;
                    }
                    var j = 0;
                    if (casKeySpaces[j]) {
                        connectToCass(casKeySpaces[j]);
                    } else {
                        return pCallback('No Keyspaces Matching.');
                    }

                    // Get the cassandra from list, if not exist add to list
                    function connectToCass(keySpaceDetail) {
                        try {
                            var conn = {
                                contactPoints: server,
                                authProvider: auth,
                                keyspace: keySpaceDetail.KeySpace,
                                protocolOptions: {
                                    port: port
                                },
                                pooling: {
                                    coreConnectionsPerHost: 2
                                }
                            };
                            var currentKey = '';
                            for (var k = 0; k < arrConnectedServers.length; k++) {
                                var item = arrConnectedServers[k];
                                if (JSON.stringify(item.conn) == JSON.stringify(conn)) {
                                    currentKey = item.keyName;
                                    break;
                                }
                            }
                            if (cassandraSessionValues[pRedisKey]) { // for maintain existing session
                                keySpaceValues = cassandraSessionValues[pRedisKey];
                            }
                            if (currentKey != '') {
                                var keyName = currentKey.split('@')[0];
                                var keyCode = currentKey.split('@')[1];
                                if (keyCode != keySpaceDetail.Code) {
                                    keySpaceValues[keySpaceDetail.Code] = keySpaceValues[keyCode];
                                } else {
                                    keySpaceValues[keySpaceDetail.Code] = cassandraSessionValues[keyName][keyCode];
                                }
                                j++;
                                if (j < casKeySpaces.length) {
                                    connectToCass(casKeySpaces[j]);
                                } else if (j == casKeySpaces.length) {
                                    cassandraSessionValues[pRedisKey.toUpperCase()] = keySpaceValues;
                                    var result = {};
                                    result.status = 'SUCCESS';
                                    result.sessionCount = Object.keys(cassandraSessionValues).length;
                                    i++;
                                    if (i == casServers.length) {
                                        return pCallback(result);
                                    } else {
                                        createNewCassServer(casServers[i]);
                                    }
                                }
                            } else {
                                var client = new cassandra.Client(conn);
                                client.connect(function (error) {
                                    try {
                                        if (error) {
                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233052', 'Error in connectToCass function', error);
                                            doConnect(pRedisKey, keySpaceDetail.Code);
                                            return pCallback(error);
                                        } else {
                                            client.routingkey = pRedisKey.replace(connString + '~', '').toLowerCase();
                                            var keyName = pRedisKey + '@' + keySpaceDetail.Code;
                                            pushConnectionToArray(keyName, conn);
                                            keySpaceValues[keySpaceDetail.Code] = client;
                                            j++;
                                            if (j < casKeySpaces.length) {
                                                connectToCass(casKeySpaces[j]);
                                            } else if (j == casKeySpaces.length) {
                                                cassandraSessionValues[pRedisKey.toUpperCase()] = keySpaceValues;
                                                var result = {};
                                                result.status = 'SUCCESS';
                                                result.sessionCount = Object.keys(cassandraSessionValues).length;
                                                i++;
                                                if (i == casServers.length) {
                                                    return pCallback(result);
                                                } else {
                                                    createNewCassServer(casServers[i]);
                                                }
                                            }
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233051', 'Error in connectToCass function', error);
                                    }
                                });
                            }
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233050', 'Error in connectToCass function', error);
                        }
                    }
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233049', 'Error in createNewCassServer function', error);
                }
            }
        } else {
            reqInstanceHelper.PrintInfo(serviceName, 'No results', null);
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233048', 'Error in createCassandraInstance function', error);
    }
}

function pushConnectionToArray(pKey, pConn) {
    try {
        var obj = {};
        obj.keyName = pKey;
        obj.conn = pConn;
        arrConnectedServers.push(obj);
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233047', 'Error in pushConnectionToArray function', error);
    }
}

// Get cassandra connection from the list, if not available create new one and add it to list
function getCassandraConn(pHeaders, pKeySpace, callback) {
    try {
        var tmpCasandraObjLogInfo = pHeaders.LOG_INFO ? pHeaders.LOG_INFO : null;
        reqInstanceHelper.PrintInfo(serviceName, 'Get cassandra connection for "' + pKeySpace + '" Begin', tmpCasandraObjLogInfo);
        var cassDB = null;
        if (!pHeaders) {
            pHeaders = {};
        }
        // var reqDBInstance = require('./DBInstance');
        var sessId = "SESSIONID-" + pHeaders['session-id'];
        var NeedSysRouting = 'N';
        var sysRoutingId = '';
        reqInstanceHelper.PrintInfo(serviceName, 'query session is' + sessId, tmpCasandraObjLogInfo);
        reqInstanceHelper.GetConfig(sessId, function (redisSession) {
            if (redisSession != 0) {
                reqInstanceHelper.PrintInfo(serviceName, 'Got the session id', tmpCasandraObjLogInfo);
                var parsedSession = JSON.parse(redisSession);
                if (parsedSession.length) {
                    NeedSysRouting = parsedSession[0].NEED_SYSTEM_ROUTING;
                    sysRoutingId = parsedSession[1].RoutingSId;
                    reqInstanceHelper.PrintInfo(serviceName, 'NEED_SYSTEM_ROUTING | ' + NeedSysRouting, tmpCasandraObjLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, 'SYSTEM ROUTING SID | ' + sysRoutingId, tmpCasandraObjLogInfo);
                }
            }

            reqInstanceHelper.PrintInfo(serviceName, 'routingkey ==== ' + pHeaders['routingkey'], tmpCasandraObjLogInfo);
            // var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
            var routingkey = pHeaders['routingkey'];
            if (NeedSysRouting == 'Y') {
                reqInstanceHelper.PrintInfo(serviceName, "System Routing setup available ===== ", tmpCasandraObjLogInfo);
                if (pKeySpace == 'res_cas' || pKeySpace == 'dep_cas' || pKeySpace == 'log_cas') {
                    routingkey = routingkey + '~' + sysRoutingId;
                    reqInstanceHelper.PrintInfo(serviceName, "System Routing key is " + routingkey, tmpCasandraObjLogInfo);
                }
            }
            reqInstanceHelper.GetRedisKey(connString, routingkey, function (redisKey) {
                try {
                    reqInstanceHelper.PrintInfo(serviceName, 'Finding redisKey ==== ' + redisKey, tmpCasandraObjLogInfo);
                    var keySpaceValues;
                    reqInstanceHelper.IsRedisKeyAvail(redisKey, function (result) {
                        try {
                            if (result) {
                                if (cassandraSessionValues[redisKey] && cassandraSessionValues[redisKey][pKeySpace]) {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Cassandra key available', tmpCasandraObjLogInfo);
                                    keySpaceValues = cassandraSessionValues[redisKey];
                                    cassDB = keySpaceValues[pKeySpace];
                                    return sendResult(cassDB);
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, 'New Cassandra creation', tmpCasandraObjLogInfo);
                                    if (arrRetryingKeys.indexOf(redisKey, 0) > -1) {
                                        reqInstanceHelper.PrintInfo(serviceName, 'Already Retrying', tmpCasandraObjLogInfo);
                                        return callback(null);
                                    } else {
                                        createInstancesOnRuntime(redisKey, pKeySpace, function (pResult) {
                                            try {
                                                if (pResult.status == 'SUCCESS') {
                                                    keySpaceValues = cassandraSessionValues[redisKey];
                                                    cassDB = keySpaceValues[pKeySpace];
                                                    return sendResult(cassDB);
                                                }
                                            } catch (error) {
                                                reqInstanceHelper.PrintError(serviceName, tmpCasandraObjLogInfo, 'ERR-CAS-233046', 'Error in createInstancesOnRuntime callback', error);
                                            }
                                        });
                                    }
                                }
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'Accessing default Cassandra', tmpCasandraObjLogInfo);
                                keySpaceValues = cassandraSessionValues[(connString + '~' + defaultRoutingKey).toUpperCase()];
                                if (keySpaceValues && keySpaceValues[pKeySpace]) {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Default Cassandra available', tmpCasandraObjLogInfo);
                                    cassDB = keySpaceValues[pKeySpace];
                                    return sendResult(cassDB);
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Connecting default Cassandra', tmpCasandraObjLogInfo);
                                    var defaultRedisKey = (connString + '~' + defaultRoutingKey).toUpperCase();
                                    if (arrRetryingKeys.indexOf(defaultRedisKey, 0) > -1) {
                                        reqInstanceHelper.PrintInfo(serviceName, 'Already Retrying', tmpCasandraObjLogInfo);
                                        return callback(null);
                                    } else {
                                        createInstancesOnRuntime(defaultRedisKey, pKeySpace, function (pResult) {
                                            try {
                                                if (pResult.status == 'SUCCESS') {
                                                    keySpaceValues = cassandraSessionValues[defaultRedisKey];
                                                    cassDB = keySpaceValues[pKeySpace];
                                                    return sendResult(cassDB);
                                                }
                                            } catch (error) {
                                                reqInstanceHelper.PrintError(serviceName, tmpCasandraObjLogInfo, 'ERR-CAS-233045', 'Error in createInstancesOnRuntime callback', error);
                                            }
                                        });
                                    }
                                }
                            }
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, tmpCasandraObjLogInfo, 'ERR-CAS-233044', 'Error in reqInstanceHelper.IsRedisKeyAvail callback', error);
                        }
                    });
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, tmpCasandraObjLogInfo, 'ERR-CAS-233043', 'Error in reqInstanceHelper.GetRedisKey callback', error);
                }
            });

            function sendResult(result) {
                reqInstanceHelper.PrintInfo(serviceName, 'Get cassandra connection for "' + pKeySpace + '" Ended', tmpCasandraObjLogInfo);
                result.schemaName = pKeySpace;
                return callback(result);
            }

        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, tmpCasandraObjLogInfo, 'ERR-CAS-233042', 'Error in getCassandraConn function', error);
    }
}

// This is for cassandra health check up
function getCassandraConnForTesting(pHeaders, pKeySpace, callback) {
    try {
        var cassDB = null;
        reqInstanceHelper.GetRedisKey(connString, pHeaders['routingkey'], function (redisKey) {
            try {
                var keySpaceValues;
                reqInstanceHelper.IsRedisKeyAvail(redisKey, function (result) {
                    try {
                        if (result) {
                            if (cassandraSessionValues[redisKey]) {
                                keySpaceValues = cassandraSessionValues[redisKey];
                                cassDB = keySpaceValues[pKeySpace];
                                return callback(cassDB);
                            } else {
                                //reqInstanceHelper.PrintInfo(serviceName, 'New Cassandra creation', null);
                                if (arrRetryingKeys.indexOf(redisKey, 0) > -1) {
                                    //reqInstanceHelper.PrintInfo(serviceName, 'Already Retrying');
                                } else {
                                    createInstancesOnRuntime(redisKey, pKeySpace, function (pResult) {
                                        try {
                                            if (pResult.status == 'SUCCESS') {
                                                keySpaceValues = cassandraSessionValues[redisKey];
                                                cassDB = keySpaceValues[pKeySpace];
                                                return callback(cassDB);
                                            }
                                        } catch (error) {
                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233041', 'Error in getCassandraConnForTesting function', error);
                                        }
                                    });
                                }
                            }
                        } else {
                            keySpaceValues = cassandraSessionValues[(connString + '~' + defaultRoutingKey).toUpperCase()];
                            cassDB = keySpaceValues[pKeySpace];
                            return callback(cassDB);
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233040', 'Error in getCassandraConnForTesting function', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233039', 'Error in getCassandraConnForTesting function', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233038', 'Error in getCassandraConnForTesting function', error);
    }
}

// for deployment dev case
function getCassandraForLoadMenuItemScreen(pHeaders, pKeySpace, callback) {
    try {
        var cassDB = null;
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
                            if (cassandraSessionValues[redisKey]) {
                                reqInstanceHelper.PrintInfo(serviceName, 'Cassandra available', null);
                                keySpaceValues = cassandraSessionValues[redisKey];
                                cassDB = keySpaceValues[pKeySpace];
                                return callback(cassDB);
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'New Cassandra creation', null);
                                createInstancesOnRuntime(redisKey, pKeySpace, function (pResult) {
                                    try {
                                        if (pResult.status == 'SUCCESS') {
                                            keySpaceValues = cassandraSessionValues[redisKey];
                                            cassDB = keySpaceValues[pKeySpace];
                                            return callback(cassDB);
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233037', 'Error in getCassandraForLoadMenuItemScreen function', error);
                                    }
                                });
                            }
                        } else {
                            if (redisKey.toUpperCase().indexOf('ENV-DEV') != -1) {
                                reqInstanceHelper.PrintInfo(serviceName, 'Accessing default Cassandra', null);
                                keySpaceValues = cassandraSessionValues[(connString + '~' + defaultRoutingKey).toUpperCase()];
                                cassDB = keySpaceValues[pKeySpace];
                                return callback(cassDB);
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'Cassandra not available. Please check your Redis Key.', null);
                                return callback(null);
                            }
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233036', 'Error in getCassandraForLoadMenuItemScreen function', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233035', 'Error in getCassandraForLoadMenuItemScreen function', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233034', 'Error in getCassandraForLoadMenuItemScreen function', error);
    }
}

// Create cassandra instances on first time call
function createInstancesOnRuntime(pRedisKey, pKeySpace, callback) {
    try {
        reqInstanceHelper.GetConfig(pRedisKey, function (pConf) {
            try {
                var objResult = JSON.parse(pConf);
                createCassandraInstance(pRedisKey, objResult, function (pResult) {
                    try {
                        return callback(pResult);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233033', 'Error in createInstancesOnRuntime function', error);
                    }
                }, pKeySpace);
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233032', 'Error in createInstancesOnRuntime function', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233031', 'Error in createInstancesOnRuntime function', error);
    }
}

var arrDoConnect = [];
var arrRetryingKeys = [];

// For cassandra health checkup retrying in failure case
function doConnect(redisKey, keySpace) {
    try {
        function callback(result) {
            try {
                if (result.status == 'SUCCESS') {
                    //CheckCassandraAvail(redisKey, keySpace, function (result) {
                    //if (result == 'SUCCESS') {
                    for (var i = 0; i < arrDoConnect.length; i++) {
                        var obj = arrDoConnect[i];
                        if (obj.redisKey == redisKey) {
                            clearInterval(obj.interval);
                            //arrRetryingKeys.pop(redisKey);
                            //arrDoConnect.pop(obj);
                            arrRetryingKeys.splice(i, 1);
                            arrDoConnect.splice(i, 1);
                            //var newObj = arrDoConnect[i];
                            reqInstanceHelper.PrintInfo(serviceName, redisKey + ' Retry stoped.', null);
                            //break;
                        }
                    }
                    //}
                    // else {
                    //     reqInstanceHelper.PrintInfo(serviceName, 'Cassandra ' + redisKey + ' Retry', null);
                    // }
                    //});
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233030', 'Error in doConnect function', error);
            }
        }
        if (arrRetryingKeys.indexOf(redisKey, 0) > -1) {
            reqInstanceHelper.PrintInfo(serviceName, redisKey + ' Already Retrying.', null);
        } else {
            reqInstanceHelper.PrintInfo(serviceName, redisKey + ' Initiated Retrying.', null);
            var interval = setInterval(createInstancesOnRuntime, 15000, redisKey, keySpace, callback);
            var obj = {};
            obj.redisKey = redisKey;
            obj.interval = interval;
            arrRetryingKeys.push(redisKey);
            arrDoConnect.push(obj);
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233029', 'Error in doConnect function', error);
    }
}


// For health check up
function checkAllCassandraAvail(callback) {
    try {
        var i = 0;
        var returnStr = 'SUCCESS';
        //var result = 'SUCCESS';
        if (arrConnectedServers.length) {
            check(arrConnectedServers[i].keyName);

            function check(currentKey) {
                try {
                    i++;
                    var redisKey = currentKey.split('@')[0];
                    var keySpace = currentKey.split('@')[1];
                    if (cassandraSessionValues[redisKey]) {
                        var routingkey = redisKey.replace(connString + '~', '');
                        var headers = {
                            routingkey: routingkey
                        };
                        getCassandraConnForTesting(headers, keySpace, function (client) {
                            try {
                                CheckCassandraAvail(client, function (result) {
                                    try {
                                        if (result == 'SUCCESS') {
                                            //reqInstanceHelper.PrintInfo(serviceName, 'Cassandra ' + keySpace + ' in connected state', null);
                                        } else {
                                            //reqInstanceHelper.PrintInfo(serviceName, 'Cassandra ' + keySpace + ' not connected', null);
                                            returnStr = result + 'Cassandra ' + keySpace + ' not connected';
                                            var intArrLength = arrConnectedServers.length;
                                            for (var j = 0; j < intArrLength; j++) {
                                                var obj = arrConnectedServers[j];
                                                var strRedisKey = obj.keyName.split('@')[0];
                                                if (strRedisKey == redisKey) {
                                                    arrConnectedServers.splice(j, 1);
                                                    j--;
                                                    intArrLength = arrConnectedServers.length;
                                                }
                                            }
                                            var cassandraSession = cassandraSessionValues[redisKey];
                                            //Disconnect cassandra keyspace connections
                                            var cassandraSessionKeys = Object.keys(cassandraSession);
                                            for (var k = 0; k < cassandraSessionKeys.length; k++) {
                                                var currentKey = cassandraSessionKeys[k];
                                                var session = cassandraSession[currentKey];
                                                session.shutdown(); //this Disconnect cassandra
                                            }
                                            delete cassandraSessionValues[redisKey];
                                            doConnect(redisKey, keySpace);
                                        }
                                        if (i < arrConnectedServers.length) {
                                            check(arrConnectedServers[i].keyName);
                                        } else {
                                            if (arrRetryingKeys.length == 0) {
                                                return callback(returnStr);
                                            } else {
                                                return callback('FAILURE');
                                            }
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233028', 'Error in checkAllCassandraAvail function', error);
                                    }
                                });
                            } catch (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233027', 'Error in checkAllCassandraAvail function', error);
                            }
                        });
                    } else {
                        // for (var j = 0; j < arrConnectedServers.length; j++) {
                        //     var obj = arrConnectedServers[j];
                        //     var strRedisKey = obj.keyName.split('@')[0];
                        //     if (strRedisKey == redisKey) {
                        //         arrConnectedServers.splice(j, 1);
                        //     }
                        // }
                        //     if (i < arrConnectedServers.length) {
                        //         check(arrConnectedServers[i].keyName);
                        //     } else {
                        //         if (arrRetryingKeys.length == 0) {
                        //             return callback(returnStr);
                        //         } else {
                        return callback('FAILURE');
                        //         }
                        //     }
                    }
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233026', 'Error in checkAllCassandraAvail function', error);
                }
            }
        } else {
            if (arrRetryingKeys.length == 0) {
                return callback('SUCCESS');
            } else {
                return callback('FAILURE');
            }
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233025', 'Error in checkAllCassandraAvail function', error);
    }
}

// Check a system query for checking cassandra availablity
function CheckCassandraAvail(client, callback) {
    try {
        var query = 'SELECT * FROM system.local';
        if (client) {
            client.execute(query, function (error, result) {
                try {
                    if (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233024', 'Error in CheckCassandraAvail function', error);
                        // if(error){ // check host plm then initiate retry.

                        // }
                        return callback('FAILURE');
                    } else {
                        return callback('SUCCESS');
                    }
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233023', 'Error in CheckCassandraAvail function', error);
                }
            });
        } else {
            return callback('FAILURE');
        }

    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-CAS-233022', 'Error in CheckCassandraAvail function', error);
    }
}

// Disconnect all cassandra instances
function Disconnect(callback) {
    try {
        var i = 0;
        if (arrConnectedServers.length) {
            doDisconnect(arrConnectedServers[i].keyName);
        } else {
            cassandraSessionValues = {};
            arrConnectedServers = [];
            return callback();
        }

        function doDisconnect(currentKey) {
            try {
                i++;
                var redisKey = currentKey.split('@')[0];
                var keySpace = currentKey.split('@')[1];
                cassandraSessionValues[redisKey][keySpace].shutdown(function (error, result) {
                    try {
                        reqInstanceHelper.PrintInfo(serviceName, currentKey + '.....Disconnected.', null);
                        if (i < arrConnectedServers.length) {
                            doDisconnect(arrConnectedServers[i].keyName);
                        } else {
                            cassandraSessionValues = {};
                            arrConnectedServers = [];
                            return callback();
                        }
                    } catch (error) {
                        return callback(error);
                    }
                });
            } catch (error) {
                return callback(error);
            }
        }
    } catch (error) {
        return callback(error);
    }
}

// GetTableData from Cassandra DB
function GetTableNoSqlDb(pClient, pTableName, pColumnList, pCond, pLogInfo, pCallback) {
    try {
        var headers = { routingkey: pClient.routingkey };
        reqCassandraHelper.GetTableData(headers, pClient, pTableName, pColumnList, pCond, pLogInfo, function (pResult, pError) {
            try {
                pCallback(pResult, pError);
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233021', 'Error in Disconnect function', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233020', 'Error in Disconnect function', error);
    }
}

// GetTableData from Cassandra DB
function GetTableNoSqlDbNoCache(pClient, pTableName, pColumnList, pCond, pLogInfo, pCallback) {
    try {
        var headers = { routingkey: pClient.routingkey };
        reqCassandraHelper.GetTableDataNoCache(headers, pClient, pTableName, pColumnList, pCond, pLogInfo, function (pResult, pError) {
            try {
                pCallback(pResult, pError);
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233021', 'Error in Disconnect function', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233020', 'Error in Disconnect function', error);
    }
}

// Insert into cassandra db
function InsertNoSqlDb(pClient, pTableName, pRows, pLogInfo, pCallback, pDataType) {
    try {
        reqCassandraHelper.Insert(pClient, pTableName, pRows, pLogInfo, function (pResult, pError) {
            try {
                pCallback(pResult, pError);
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233019', 'Error in InsertNoSqlDb function', error);
            }
        }, pDataType);
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233018', 'Error in InsertNoSqlDb function', error);
    }
}

// Update cassandra DB
function UpdateNoSqlDb(pClient, pTableName, pRows, pCond, pLogInfo, pCallback) {
    try {
        reqCassandraHelper.Update(pClient, pTableName, pRows, pCond, pLogInfo, function (pResult, pError) {
            try {
                pCallback(pResult, pError);
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233017', 'Error in UpdateNoSqlDb function', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233016', 'Error in UpdateNoSqlDb function', error);
    }
}

// Delete cassandra Db
function DeleteNoSqlDb(pClient, pTableName, pCond, pLogInfo, pCallback) {
    try {
        reqCassandraHelper.Delete(pClient, pTableName, pCond, pLogInfo, function (pResult, pError) {
            try {
                pCallback(pResult, pError);
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233015', 'Error in DeleteNoSqlDb function', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233014', 'Error in DeleteNoSqlDb function', error);
    }
}

// Execute Raw Query on cassandra DB
function ExecuteQuery(pClient, pQuery, pLogInfo, pCallback) {
    try {
        reqCassandraHelper.ExecuteRawQuery(pClient, pQuery, pLogInfo, function (pResult, pError) {
            try {
                pCallback(pResult, pError);
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233013', 'Error in ExecuteQuery function', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233012', 'Error in ExecuteQuery function', error);
    }
}

module.exports = {
    CreateCassandraInstance: createCassandraInstance,
    GetCassandraConn: getCassandraConn,
    GetCassandraForLoadMenuItemScreen: getCassandraForLoadMenuItemScreen,
    CheckAllCassandraAvail: checkAllCassandraAvail,
    Disconnect: Disconnect,
    GetTableNoSqlDb: GetTableNoSqlDb,
    InsertNoSqlDb: InsertNoSqlDb,
    UpdateNoSqlDb: UpdateNoSqlDb,
    DeleteNoSqlDb: DeleteNoSqlDb,
    ExecuteQuery: ExecuteQuery,
    GetTableNoSqlDbNoCache: GetTableNoSqlDbNoCache
};
/********* End of File ************/