/*
 * @Decsriptions      : To handle transaction db operations
 * @Last Error Code  : 'ERR-KNEX-241107'
 */

// Require dependencies
var reqInstanceHelper = require('../common/InstanceHelper');
var reqKnexHelper = require('./db/KnexHelper');
var reqEncryptionInstance = require('../common/crypto/EncryptionInstance');

var tranDBClient = 'pg';
var mOrm = 'knex';
var connString = 'ANALYTICS';
var fxConnString = 'POSTGRES';
var fxDBClient = 'pg';
var mTranSessionValues = {};
var mTranSessionValuesWithTrx = {};
var arrConnectedServers = [];
var defaultRoutingKey = 'clt-0~app-0~tnt-0~env-0';
var serviceName = 'AnalyticInstance';
var objLogInfo = null;


function loadTranDBClient(serviceModel) {
    if (serviceModel.TRANDB == "POSTGRES") {
        tranDBClient = 'pg';
    } else if (serviceModel.TRANDB == "ORACLE") {
        tranDBClient = 'oracledb';
    } else if (serviceModel.TRANDB == "MYSQL") {
        tranDBClient = 'mysql';
    }
}

function loadFxDBClient(serviceModel) {
    fxConnString = serviceModel.TRANDB ? serviceModel.TRANDB : 'POSTGRES';
    if (fxConnString.toUpperCase() == "POSTGRES") {
        fxDBClient = 'pg';
    } else if (fxConnString.toUpperCase() == "ORACLE") {
        fxDBClient = 'oracledb';
    } else if (fxConnString.toUpperCase() == "MYSQL") {
        fxDBClient = 'mysql';
    }
}

function CreateTranDBInstance(pOrm, pRedisKey, pVal, pCallback) {
    try {
        if (pOrm == 'knex') {
            var tranDBConfig = pVal; //JSON.parse(pVal);
            var conn;
            var strEncPwd = reqEncryptionInstance.DoDecrypt(tranDBConfig.Password.toLowerCase());
            if (tranDBConfig.DB_TYPE) {
                if (tranDBConfig.DB_TYPE == "POSTGRES") {
                    tranDBClient = 'pg';
                } else if (tranDBConfig.DB_TYPE == "ORACLE") {
                    tranDBClient = 'oracledb';
                } else if (tranDBConfig.DB_TYPE == "MYSQL") {
                    tranDBClient = 'mysql';
                }
            } else {
                tranDBClient = 'pg';
            }
            switch (tranDBClient.toLowerCase()) {
                case 'pg':
                case 'mysql':
                    conn = {
                        host: tranDBConfig.Server,
                        port: tranDBConfig.Port,
                        user: tranDBConfig.UserID,
                        password: strEncPwd,
                        database: tranDBConfig.Database
                    }
                    break;
                case 'oracledb':
                    conn = {
                        user: tranDBConfig.UserID,
                        password: strEncPwd,
                        connectString: '//' + tranDBConfig.Server + ':' + tranDBConfig.Port + '/' + tranDBConfig.Database
                    }
                    break;
                default:
                    break;
            }
            var currentKey = '';
            for (var i = 0; i < arrConnectedServers.length; i++) {
                var item = arrConnectedServers[i];
                if (item.conn == JSON.stringify(conn)) {
                    currentKey = item.keyName;
                    break;
                }
            }
            if (currentKey != '') {
                //console.log('Tran Server Already Connected');
                addToTranDBSession(pRedisKey, mTranSessionValues[currentKey], mTranSessionValuesWithTrx[currentKey], tranDBClient.toLowerCase());
                var result = {};
                result.status = 'SUCCESS';
                result.sessionCount = Object.keys(mTranSessionValues).length;
                return pCallback(result);
            } else {
                reqKnexHelper.GetKnexConnection(tranDBClient.toLowerCase(), conn, tranDBConfig.SearchPath, tranDBConfig.Pool, function callback(error, knexConn, knexConnForTrx, pDBType) {
                    try {
                        if (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241105', 'FAILURE for ' + pRedisKey, error);
                            doConnect(pRedisKey);
                            return pCallback(error);
                        } else {
                            addToTranDBSession(pRedisKey, knexConn, knexConnForTrx, pDBType);
                            pushConnectionToArray(pRedisKey, conn);
                            var result = {};
                            result.status = 'SUCCESS';
                            result.sessionCount = Object.keys(mTranSessionValues).length;
                            return pCallback(result);
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241104', 'Error in CreateTranDBInstance function', error);
                    }
                });
            }
        } else if (pOrm == 'something') { //change  it soon

        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241103', 'Error in CreateTranDBInstance function', error);
        return pCallback('FAILURE');
    }
}

function Disconnect(callback) {
    try {
        var i = 0;
        if (arrConnectedServers.length) {
            doDisconnect(arrConnectedServers[i].keyName);
        } else {
            mTranSessionValues = {};
            arrConnectedServers = [];
            return callback();
        }
        function doDisconnect(currentKey) {
            try {
                i++;
                if (currentKey.split('~', currentKey.length)[0] == 'MYSQL' || currentKey.split('~', currentKey.length)[0] == 'POSTGRES' || currentKey.split('~', currentKey.length)[0] == 'ORACLE') {
                    var redisKey = currentKey.split('@')[0];
                    var schema = currentKey.split('@')[1];
                    reqKnexHelper.DestroyKnexConnection(mTranSessionValues[redisKey].Connection[schema], function (error, result) {
                        try {
                            reqKnexHelper.DestroyKnexConnection(mTranSessionValuesWithTrx[redisKey].Connection[schema], function (error, result) {
                                try {
                                    if (error) {
                                        return callback(error);
                                    } else {
                                        reqInstanceHelper.PrintInfo(serviceName, currentKey + '.....Disconnected.', null);
                                        if (i < arrConnectedServers.length) {
                                            doDisconnect(arrConnectedServers[i].keyName);
                                        } else {
                                            mTranSessionValues = {};
                                            arrConnectedServers = [];
                                            return callback();
                                        }
                                    }
                                } catch (error) {
                                    return callback(error);
                                }
                            });
                        } catch (error) {
                            return callback(error);
                        }
                    });
                } else {
                    reqKnexHelper.DestroyKnexConnection(mTranSessionValues[currentKey].Connection, function (error, result) {
                        try {
                            reqKnexHelper.DestroyKnexConnection(mTranSessionValuesWithTrx[currentKey].Connection, function (error, result) {
                                try {
                                    if (error) {
                                        return callback(error);
                                    } else {
                                        reqInstanceHelper.PrintInfo(serviceName, currentKey + '.....Disconnected.', null);
                                        if (i < arrConnectedServers.length) {
                                            doDisconnect(arrConnectedServers[i].keyName);
                                        } else {
                                            mTranSessionValues = {};
                                            arrConnectedServers = [];
                                            return callback();
                                        }
                                    }
                                } catch (error) {
                                    return callback(error);
                                }
                            });
                        } catch (error) {
                            return callback(error);
                        }
                    });
                }
            } catch (error) {
                return callback(error);
            }
        }
    } catch (error) {
        return callback(error);
    }
}

// this is for insert by orm
function InsertTranDB(pSession, pTableName, pRows, pLogInfo, pCallback) {
    try {
        if (pSession.DBConn.Orm == 'knex') {
            reqKnexHelper.Insert(pSession.DBConn.Connection, pSession.trx, pTableName, pRows, pLogInfo, pSession.DBConn.DBType, function (pResult, pError) {
                try {
                    pCallback(pResult, pError);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-241102', 'Error in InsertTranDB function', error);
                }
            });
        } else if (pSession.DBConn.Orm == 'something') {

        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-241101', 'Error in InsertTranDB function', error);
    }
}

// this is for bulk insert by orm
function InsertBulkTranDB(pSession, pTableName, pRows, pLogInfo, pChunckSize, pCallback) {
    try {
        if (pSession.DBConn.Orm == 'knex') {
            reqKnexHelper.InsertBulk(pSession.DBConn.Connection, pSession.trx, pTableName, pRows, pLogInfo, pSession.DBConn.DBType, pChunckSize, function (pResult, pError) {
                try {
                    pCallback(pResult, pError);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-241102', 'Error in InsertTranDB function', error);
                }
            });
        } else if (pSession.DBConn.Orm == 'something') {

        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-241101', 'Error in InsertTranDB function', error);
    }
}

// this is for select by orm
function GetTableFromTranDB(pSession, pTableName, pCond, pLogInfo, pCallback) {
    try {
        var headers = { routingkey: pSession.DBConn.routingkey };
        if (pSession.DBConn.Orm == 'knex') {
            reqKnexHelper.List(headers, pSession.DBConn.Connection, pSession.trx, pTableName, pCond, pLogInfo, pSession.DBConn.DBType, function (pResult, pError) {
                try {
                    pCallback(pResult, pError);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-241100', 'Error in GetTableFromTranDB function', error);
                }
            });
        } else if (pSession.DBConn.Orm == 'something') {

        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-241099', 'Error in GetTableFromTranDB function', error);
    }
}

// this is for update by orm
function UpdateTranDB(pSession, pTableName, pRows, pCond, pLogInfo, pCallback) {
    try {
        if (pSession.DBConn.Orm == 'knex') {
            reqKnexHelper.Update(pSession.DBConn.Connection, pSession.trx, pTableName, pRows, pCond, pLogInfo, pSession.DBConn.DBType, function (pResult, pError) {
                try {
                    pCallback(pResult, pError);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-241098', 'Error in UpdateTranDB function', error);
                }
            });
        } else if (pSession.DBConn.Orm == 'something') {

        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-241097', 'Error in UpdateTranDB function', error);
    }
}

// this is for update by orm
function DeleteTranDB(pSession, pTableName, pCond, pLogInfo, pCallback) {
    try {
        if (pSession.DBConn.Orm == 'knex') {
            reqKnexHelper.Delete(pSession.DBConn.Connection, pSession.trx, pTableName, pCond, pLogInfo, pSession.DBConn.DBType, function (pResult, pError) {
                try {
                    pCallback(pResult, pError);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-241096', 'Error in DeleteTranDB function', error);
                }
            });
        } else if (pSession.DBConn.Orm == 'something') {

        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-241095', 'Error in DeleteTranDB function', error);
    }
}

function ExecuteSQLQuery(pSession, pQuery, pLogInfo, pCallback) {
    try {
        if (pSession.DBConn.Orm == 'knex') {
            reqKnexHelper.ExecuteSQLQuery(pSession.DBConn.Connection, pSession.trx, pQuery, pLogInfo, pSession.DBConn.DBType, function (pResult, pError) {
                try {
                    pCallback(pResult, pError);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-241094', 'Error in ExecuteSQLQuery function', error);
                }
            });
        } else if (pSession.DBConn.Orm == 'something') {

        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-241093', 'Error in ExecuteSQLQuery function', error);
    }
}

function ExecuteQueryWithPagingCount(pSession, pQuery, pPageNo, pPageSize, pLogInfo, pCallback) {
    try {
        if (pSession.DBConn.Orm == 'knex') {
            reqKnexHelper.ExecuteQueryWithPagingCount(pSession.DBConn.DBType, pSession.DBConn.Connection, pSession.trx, pQuery, pPageNo, pPageSize, pLogInfo, function (pResult, pCount, pError) {
                try {
                    pCallback(pResult, pCount, pError);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-241092', 'Error in ExecuteQueryWithPagingCount function', error);
                }
            });
        } else if (pSession.DBConn.Orm == 'something') {

        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-241091', 'Error in ExecuteQueryWithPagingCount function', error);
    }
}

function ExecuteProcedure(pSession, pProcedure, pBindParams, pLogInfo, pCallback) {
    try {
        if (pSession.DBConn.Orm == 'knex') {
            reqKnexHelper.ExecuteProcedure(pSession.DBConn.Connection, pSession.trx, pProcedure, pLogInfo, pSession.DBConn.DBType, pBindParams, function (pResult, pError) {
                try {
                    pCallback(pResult, pError);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-241106', 'Error in ExecuteProcedure function', error);
                }
            });
        } else if (pSession.DBConn.Orm == 'something') {

        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-241107', 'Error in ExecuteProcedure function', error);
    }
}

// this will return tranDB Connection
function getTranDBConn(pHeaders, IsTransactionScope, callback) {
    try {
        var tmpTranObjLogInfo = pHeaders.LOG_INFO ? pHeaders.LOG_INFO : null;
        reqInstanceHelper.PrintInfo(serviceName, 'GetTranDBConn Begin', tmpTranObjLogInfo);
        //IsTransactionScope = false;
        if (!pHeaders) {
            pHeaders = {};
        }
        var reqDBInstance = require('./DBInstance');
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        loadFxDBClient(serviceModel);
        loadTranDBClient(serviceModel);
        var tranDB = new Object();
        reqInstanceHelper.PrintInfo(serviceName, 'routingkey ==== ' + pHeaders['routingkey'], tmpTranObjLogInfo);
        reqInstanceHelper.GetRedisKey(connString, pHeaders['routingkey'], function (redisKey) {
            try {
                reqInstanceHelper.PrintInfo(serviceName, 'Finding redisKey ==== ' + redisKey, tmpTranObjLogInfo);
                reqInstanceHelper.IsRedisKeyAvail(redisKey, function (result) {
                    try {
                        if (result) {
                            if (mTranSessionValues[redisKey.toUpperCase()]) {
                                reqInstanceHelper.PrintInfo(serviceName, 'TranDB key available', tmpTranObjLogInfo);
                                //tranDB.DBConn = mTranSessionValues[redisKey.toUpperCase()];
                                if (IsTransactionScope) {
                                    tranDB.DBConn = mTranSessionValuesWithTrx[redisKey.toUpperCase()];
                                    reqKnexHelper.GetTransactionScope(tranDB.DBConn.Connection, function (trx) {
                                        try {
                                            tranDB.trx = trx;
                                            return sendResult(tranDB);
                                        } catch (error) {
                                            reqInstanceHelper.PrintError(serviceName, tmpTranObjLogInfo, 'ERR-KNEX-241090', 'Error in getTranDBConn function', error);
                                        }
                                    });
                                } else {
                                    tranDB.DBConn = mTranSessionValues[redisKey.toUpperCase()];
                                    tranDB.trx = null;
                                    return sendResult(tranDB);
                                }
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'New TranDB creation', tmpTranObjLogInfo);
                                createInstancesOnRuntime(redisKey, function (pResult) {
                                    try {
                                        if (pResult.status == 'SUCCESS') {
                                            //tranDB.DBConn = mTranSessionValues[redisKey.toUpperCase()];
                                            if (IsTransactionScope) {
                                                tranDB.DBConn = mTranSessionValuesWithTrx[redisKey.toUpperCase()];
                                                reqKnexHelper.GetTransactionScope(tranDB.DBConn.Connection, function (trx) {
                                                    try {
                                                        tranDB.trx = trx;
                                                        return sendResult(tranDB);
                                                    } catch (error) {
                                                        reqInstanceHelper.PrintError(serviceName, tmpTranObjLogInfo, 'ERR-KNEX-241089', 'Error in getTranDBConn function', error);
                                                    }
                                                });
                                            } else {
                                                tranDB.DBConn = mTranSessionValues[redisKey.toUpperCase()];
                                                tranDB.trx = null;
                                                return sendResult(tranDB);
                                            }
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.PrintError(serviceName, tmpTranObjLogInfo, 'ERR-KNEX-241088', 'Error in getTranDBConn function', error);
                                    }
                                });
                            }
                        } else {
                            reqInstanceHelper.PrintInfo(serviceName, 'Accessing Default TranDB', tmpTranObjLogInfo);
                            var defaultRedisKey = (connString + '~' + defaultRoutingKey).toUpperCase();
                            if (IsTransactionScope) {
                                tranDB.DBConn = mTranSessionValuesWithTrx[defaultRedisKey.toUpperCase()];
                                if (tranDB.DBConn) {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Default TranDB Available', tmpTranObjLogInfo);
                                    reqKnexHelper.GetTransactionScope(tranDB.DBConn.Connection, function (trx) {
                                        try {
                                            tranDB.trx = trx;
                                            return sendResult(tranDB);
                                        } catch (error) {
                                            reqInstanceHelper.PrintError(serviceName, tmpTranObjLogInfo, 'ERR-KNEX-241087', 'Error in getTranDBConn function', error);
                                        }
                                    });
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Connecting default TranDB', tmpTranObjLogInfo);
                                    createInstancesOnRuntime(defaultRedisKey, function (pResult) {
                                        try {
                                            if (pResult.status == 'SUCCESS') {
                                                tranDB.DBConn = mTranSessionValuesWithTrx[defaultRedisKey.toUpperCase()];
                                                reqKnexHelper.GetTransactionScope(tranDB.DBConn.Connection, function (trx) {
                                                    try {
                                                        tranDB.trx = trx;
                                                        return sendResult(tranDB);
                                                    } catch (error) {
                                                        reqInstanceHelper.PrintError(serviceName, tmpTranObjLogInfo, 'ERR-KNEX-241086', 'Error in getTranDBConn function', error);
                                                    }
                                                });
                                            }
                                        } catch (error) {
                                            reqInstanceHelper.PrintError(serviceName, tmpTranObjLogInfo, 'ERR-KNEX-241085', 'Error in getTranDBConn function', error);
                                        }
                                    });
                                }
                            } else {
                                tranDB.DBConn = mTranSessionValues[defaultRedisKey.toUpperCase()];
                                if (tranDB.DBConn) {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Default TranDB Available', tmpTranObjLogInfo);
                                    tranDB.trx = null;
                                    return sendResult(tranDB);
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Connecting default TranDB', tmpTranObjLogInfo);
                                    createInstancesOnRuntime(defaultRedisKey, function (pResult) {
                                        try {
                                            if (pResult.status == 'SUCCESS') {
                                                tranDB.DBConn = mTranSessionValues[defaultRedisKey.toUpperCase()];
                                                tranDB.trx = null;
                                                return sendResult(tranDB);
                                            }
                                        } catch (error) {
                                            reqInstanceHelper.PrintError(serviceName, tmpTranObjLogInfo, 'ERR-KNEX-241084', 'Error in getTranDBConn function', error);
                                        }
                                    });
                                }
                            }
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, tmpTranObjLogInfo, 'ERR-KNEX-241083', 'Error in getTranDBConn function', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, tmpTranObjLogInfo, 'ERR-KNEX-241082', 'Error in getTranDBConn function', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, tmpTranObjLogInfo, 'ERR-KNEX-241081', 'Error in getTranDBConn function', error);
    }
    function sendResult(result) {
        reqInstanceHelper.PrintInfo(serviceName, 'GetTranDBConn End', tmpTranObjLogInfo);
        return callback(result);
    }
}

function pushConnectionToArray(pKey, pConn) {
    try {
        var obj = {};
        obj.keyName = pKey;
        obj.conn = JSON.stringify(pConn);
        arrConnectedServers.push(obj);
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241080', 'Error in pushConnectionToArray function', error);
    }
}

// this will initiate to load connections for this service in runtime
function createInstancesOnRuntime(pRedisKey, callback, pSearchPath) {
    try {
        reqInstanceHelper.GetConfig(pRedisKey, function (pConf) {
            try {
                var objResult = JSON.parse(pConf);
                if (pRedisKey.indexOf(connString) > -1) {
                    CreateTranDBInstance(mOrm, pRedisKey, objResult, function (pResult) {
                        try {
                            return callback(pResult);
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241079', 'Error in createInstancesOnRuntime function', error);
                        }
                    });
                } else {
                    createFxDBInstance(mOrm, pRedisKey, objResult, function (pResult) {
                        try {
                            return callback(pResult);
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241078', 'Error in createInstancesOnRuntime function', error);
                        }
                    }, pSearchPath);
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241077', 'Error in createInstancesOnRuntime function', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241076', 'Error in createInstancesOnRuntime function', error);
    }
}

function tranInsertUpdate(pSession, arrTableDetails, callback) {
    try {
        if (pSession.DBConn.Orm == 'knex') {
            reqKnexHelper.KnexTranInsertUpdate(pSession.DBConn.Connection, pSession.trx, arrTableDetails, pSession.DBConn.DBType, function (result) {
                try {
                    callback(result);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241075', 'Error in tranInsertUpdate function', error);
                }
            });
        } else if (pSession.DBConn.Orm == 'something') {

        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241074', 'Error in tranInsertUpdate function', error);
    }
}

function deleteMulti(pSession, pObjTableDeleteDetails, callback) {
    try {
        if (pSession.DBConn.Orm == 'knex') {
            reqKnexHelper.KnexDeleteMulti(pSession.DBConn.Connection, pObjTableDeleteDetails, pSession.DBConn.DBType, function (result) {
                try {
                    callback(result);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241073', 'Error in deleteMulti function', error);
                }
            });
        } else if (pSession.DBConn.Orm == 'something') {

        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241072', 'Error in deleteMulti function', error);
    }
}

function tranDeleteUpdate(pSession, arrTableDetails, callback) {
    try {
        if (pSession.DBConn.Orm == 'knex') {
            reqKnexHelper.KnexTranDeleteUpdate(pSession.DBConn.Connection, pSession.trx, arrTableDetails, pSession.DBConn.DBType, function (result) {
                try {
                    callback(result);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241071', 'Error in tranDeleteUpdate function', error);
                }
            });
        } else if (pSession.DBConn.Orm == 'something') {

        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241070', 'Error in tranDeleteUpdate function', error);
    }
}

function addToTranDBSession(pKey, pConn, pConnForTrx, pDBType) {
    try {
        var connObj = {};
        if (pConn.Orm) {
            connObj = pConn;
        } else {
            connObj.Orm = mOrm;
            connObj.Connection = pConn;
        }
        connObj.DBType = pDBType;
        connObj.routingkey = pKey.replace(connString + '~', '').toLowerCase();
        //connObj.schemaName = pSearchPath;
        mTranSessionValues[pKey.toUpperCase()] = connObj;
        var connObjForTrx = {};
        if (pConnForTrx.Orm) {
            connObjForTrx = pConnForTrx;
        } else {
            connObjForTrx.Orm = mOrm;
            connObjForTrx.Connection = pConnForTrx;
        }
        connObjForTrx.DBType = pDBType;
        connObjForTrx.routingkey = pKey.replace(connString + '~', '').toLowerCase();
        //connObjForTrx.schemaName = pSearchPath;
        mTranSessionValuesWithTrx[pKey.toUpperCase()] = connObjForTrx;
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241069', 'Error in addToTranDBSession function', error);
    }
}

function callRollback(pSession) {
    if (pSession && pSession.trx) {
        commit(pSession, false, function (result) {
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241068', 'Trx closed (Rollback) on Response end event', null);
        });
    }
}

function commit(pSession, pIsCommit, pCallback) {
    try {
        if (pSession.DBConn.Orm == 'knex') {
            reqKnexHelper.Commit(pSession.trx, pIsCommit, function (res) {
                try {
                    pSession.trx = null;
                    pCallback('SUCCESS');
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241067', 'Error in commit function', error);
                }
            });

        } else if (pSession.DBConn.Orm == 'something') {

        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241066', 'Error in commit function', error);
    }
}

var arrDoConnect = [];
var arrRetryingKeys = [];

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
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241065', 'Error in doConnect function', error);
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
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241064', 'Error in doConnect function', error);
    }
}

function checkAllTranDBAvail(callback) {
    try {
        var i = 0;
        var returnStr = 'SUCCESS';
        //var result = 'SUCCESS';
        if (arrConnectedServers.length) {
            check(arrConnectedServers[i].keyName);

            function check(currentKey) {
                try {
                    i++;
                    var redisKey = currentKey;
                    var routingkey = redisKey.replace(connString + '~', '');
                    var headers = {
                        routingkey: routingkey
                    };
                    getTranDBConn(headers, false, function (pSession) {
                        try {
                            CheckTranDBAvail(pSession, function (result) {
                                try {
                                    if (result == 'SUCCESS') {
                                        reqInstanceHelper.PrintInfo(serviceName, connString + ' in connected state', null);
                                    } else {
                                        reqInstanceHelper.PrintInfo(serviceName, connString + ' not connected', null);
                                        returnStr = result;
                                        //doConnect(redisKey);
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
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241063', 'Error in checkAllTranDBAvail function', error);
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241062', 'Error in checkAllTranDBAvail function', error);
                        }
                    });
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241061', 'Error in checkAllTranDBAvail function', error);
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
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241060', 'Error in checkAllTranDBAvail function', error);
    }
}

function CheckTranDBAvail(pSession, callback) {
    try {
        if (pSession.DBConn.Orm == 'knex') {
            reqKnexHelper.CheckConnection(pSession.DBConn.Connection, function (result) {
                return callback(result);
            });
        } else if (pSession.DBConn.Orm == 'something') {

        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241059', 'Error in CheckTranDBAvail function', error);
    }
}

function createFxDBInstance(pOrm, pRedisKey, pVal, pCallback, pSearchPath) {
    try {
        if (pOrm == 'knex') {
            if (pVal != '') {
                var fxServers;
                if (fxConnString.toUpperCase() == 'ORACLE') {
                    fxServers = pVal.OracleServers;
                } else if (fxConnString.toUpperCase() == 'POSTGRES') {
                    fxServers = pVal.PostgresServers;
                } else if (fxConnString.toUpperCase() == 'MYSQL') {
                    fxServers = pVal.MysqlServers;
                }
                var keySpaceValues = {};
                var keySpaceValuesWithTrx = {};
                var i = 0;
                createNewTranDBServer(fxServers[i]);
            }

            function createNewTranDBServer(tranDBConfig) {
                try {
                    i++;
                    var conn;
                    var j = 0;
                    var schemas;
                    var strEncPwd = reqEncryptionInstance.DoDecrypt(tranDBConfig.Password.toLowerCase());
                    if (fxConnString.toUpperCase() == 'ORACLE') {
                        schemas = tranDBConfig.OracleSchemas;
                        conn = {
                            user: tranDBConfig.UserID,
                            password: strEncPwd,
                            connectString: '//' + tranDBConfig.Server + ':' + tranDBConfig.Port + '/' + tranDBConfig.Database
                        }
                    } else if (fxConnString.toUpperCase() == 'POSTGRES') {
                        schemas = tranDBConfig.PostgresSchemas;
                        conn = {
                            host: tranDBConfig.Server,
                            port: tranDBConfig.Port,
                            user: tranDBConfig.UserID,
                            password: strEncPwd,
                            database: tranDBConfig.Database
                        }
                    } else if (fxConnString.toUpperCase() == 'MYSQL') {
                        schemas = tranDBConfig.MysqlSchemas;
                        conn = {
                            host: tranDBConfig.Server,
                            port: tranDBConfig.Port,
                            user: tranDBConfig.UserID,
                            password: strEncPwd,
                            database: tranDBConfig.Database
                        }
                    }
                    if (pSearchPath) {
                        var newSchemas = [];
                        for (var k = 0; k < schemas.length; k++) {
                            var currentSchema = schemas[k];
                            if (currentSchema.Code == pSearchPath) {
                                newSchemas.push(currentSchema);
                            }
                        }
                        schemas = newSchemas;
                    }
                    ConnectToPg(schemas[j])

                    function ConnectToPg(schemaDetail) {
                        try {
                            j++;
                            var searchPath = schemaDetail.Schema;
                            if (fxConnString.toUpperCase() == 'ORACLE') {
                                conn.user = searchPath;
                            }
                            if (fxConnString.toUpperCase() == 'MYSQL') {
                                conn.database = searchPath;
                            }
                            var newConn = {
                                connection: conn,
                                searchPath: searchPath
                            };
                            var currentKey = '';
                            for (var k = 0; k < arrConnectedServers.length; k++) {
                                var item = arrConnectedServers[k];
                                if (item.conn == JSON.stringify(newConn)) {
                                    currentKey = item.keyName;
                                    break;
                                }
                            }
                            if (mTranSessionValues[pRedisKey]) { // for maintain existing session
                                keySpaceValues = mTranSessionValues[pRedisKey].Connection;
                                keySpaceValuesWithTrx = mTranSessionValuesWithTrx[pRedisKey].Connection;
                            }
                            if (currentKey != '') {
                                var keyName = currentKey.split('@')[0];
                                keySpaceValues[schemaDetail.Code] = mTranSessionValues[keyName].Connection[schemaDetail.Code];
                                keySpaceValuesWithTrx[schemaDetail.Code] = mTranSessionValuesWithTrx[keyName].Connection[schemaDetail.Code];
                                if (j < schemas.length) {
                                    ConnectToPg(schemas[j]);
                                } else if (j == schemas.length) {
                                    addToTranDBSession(pRedisKey, keySpaceValues, keySpaceValuesWithTrx, fxDBClient.toLowerCase());
                                    var result = {};
                                    result.status = 'SUCCESS';
                                    result.sessionCount = Object.keys(mTranSessionValues).length;
                                    //i++;
                                    if (i == fxServers.length) {
                                        return pCallback(result);
                                    } else {
                                        createNewTranDBServer(fxServers[i]);
                                    }
                                }
                            } else {
                                reqKnexHelper.GetKnexConnection(fxDBClient.toLowerCase(), conn, searchPath, tranDBConfig.Pool, function callback(error, knexConn, knexConnForTrx, pDBType) {
                                    try {
                                        if (error) {
                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241058', 'FAILURE for ' + pRedisKey, error);
                                            doConnect(pRedisKey);
                                            return pCallback(error);
                                        } else {
                                            var keyName = pRedisKey + '@' + schemaDetail.Code;
                                            pushConnectionToArray(keyName, newConn);
                                            keySpaceValues[schemaDetail.Code] = knexConn;
                                            keySpaceValuesWithTrx[schemaDetail.Code] = knexConnForTrx;
                                            if (j < schemas.length) {
                                                ConnectToPg(schemas[j]);
                                            } else if (j == schemas.length) {
                                                addToTranDBSession(pRedisKey, keySpaceValues, keySpaceValuesWithTrx, pDBType);
                                                var result = {};
                                                result.status = 'SUCCESS';
                                                result.sessionCount = Object.keys(mTranSessionValues).length;
                                                if (i == fxServers.length) {
                                                    return pCallback(result);
                                                } else {
                                                    createNewTranDBServer(fxServers[i]);
                                                }
                                            }
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241057', 'Error in createFxDBInstance function', error);
                                    }
                                });
                            }
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241108', 'Error in createFxDBInstance function', error);
                        }
                    }
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241109', 'Error in createFxDBInstance function', error);
                }
            }
        } else if (pOrm == 'something') { //change it soon

        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241056', 'Error in createFxDBInstance function', error);
        return pCallback('FAILURE');
    }
}

function getFXTranDBConn(pHeaders, pSearchPath, IsTransactionScope, callback) {
    try {
        var tmpFxTranObjLogInfo = pHeaders.LOG_INFO ? pHeaders.LOG_INFO : null;
        reqInstanceHelper.PrintInfo(serviceName, 'GetFXTranDBConn Begin', tmpFxTranObjLogInfo);
        //IsTransactionScope = false;
        var reqDBInstance = require('./DBInstance');
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        loadFxDBClient(serviceModel);
        loadTranDBClient(serviceModel);
        var tranDB = new Object();
        reqInstanceHelper.PrintInfo(serviceName, 'routingkey ==== ' + pHeaders['routingkey'], tmpFxTranObjLogInfo);
        reqInstanceHelper.GetRedisKey(fxConnString, pHeaders['routingkey'], function (redisKey) {
            try {
                reqInstanceHelper.PrintInfo(serviceName, 'Finding redisKey ==== ' + redisKey, tmpFxTranObjLogInfo);
                var keySpaceValues;
                reqInstanceHelper.IsRedisKeyAvail(redisKey, function (result) {
                    try {
                        if (result) {
                            if (mTranSessionValues[redisKey.toUpperCase()] && mTranSessionValues[redisKey.toUpperCase()].Connection[pSearchPath]) {
                                reqInstanceHelper.PrintInfo(serviceName, fxConnString + ' key available', tmpFxTranObjLogInfo);
                                if (IsTransactionScope) {
                                    keySpaceValues = mTranSessionValuesWithTrx[redisKey.toUpperCase()].Connection;
                                    tranDB.DBConn = {
                                        Connection: keySpaceValues[pSearchPath],
                                        Orm: mTranSessionValuesWithTrx[redisKey.toUpperCase()].Orm,
                                        DBType: mTranSessionValuesWithTrx[redisKey.toUpperCase()].DBType
                                    };
                                    reqKnexHelper.GetTransactionScope(tranDB.DBConn.Connection, function (trx) {
                                        try {
                                            tranDB.trx = trx;
                                            return sendResult(tranDB);
                                        } catch (error) {
                                            reqInstanceHelper.PrintError(serviceName, tmpFxTranObjLogInfo, 'ERR-KNEX-241055', 'Error in getFXTranDBConn function', error);
                                        }
                                    });
                                } else {
                                    keySpaceValues = mTranSessionValues[redisKey.toUpperCase()].Connection;
                                    tranDB.DBConn = {
                                        Connection: keySpaceValues[pSearchPath],
                                        Orm: mTranSessionValues[redisKey.toUpperCase()].Orm,
                                        DBType: mTranSessionValues[redisKey.toUpperCase()].DBType
                                    };
                                    tranDB.trx = null;
                                    return sendResult(tranDB);
                                }
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'New ' + fxConnString + ' creation', tmpFxTranObjLogInfo);
                                createInstancesOnRuntime(redisKey, function (pResult) {
                                    try {
                                        if (pResult.status == 'SUCCESS') {
                                            if (IsTransactionScope) {
                                                keySpaceValues = mTranSessionValuesWithTrx[redisKey.toUpperCase()].Connection;
                                                tranDB.DBConn = {
                                                    Connection: keySpaceValues[pSearchPath],
                                                    Orm: mTranSessionValuesWithTrx[redisKey.toUpperCase()].Orm,
                                                    DBType: mTranSessionValuesWithTrx[redisKey.toUpperCase()].DBType
                                                };
                                                reqKnexHelper.GetTransactionScope(tranDB.DBConn.Connection, function (trx) {
                                                    try {
                                                        tranDB.trx = trx;
                                                        return sendResult(tranDB);
                                                    } catch (error) {
                                                        reqInstanceHelper.PrintError(serviceName, tmpFxTranObjLogInfo, 'ERR-KNEX-241054', 'Error in getFXTranDBConn function', error);
                                                    }
                                                });
                                            } else {
                                                keySpaceValues = mTranSessionValues[redisKey.toUpperCase()].Connection;
                                                tranDB.DBConn = {
                                                    Connection: keySpaceValues[pSearchPath],
                                                    Orm: mTranSessionValues[redisKey.toUpperCase()].Orm,
                                                    DBType: mTranSessionValues[redisKey.toUpperCase()].DBType
                                                };
                                                tranDB.trx = null;
                                                return sendResult(tranDB);
                                            }
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.PrintError(serviceName, tmpFxTranObjLogInfo, 'ERR-KNEX-241053', 'Error in getFXTranDBConn function', error);
                                    }
                                }, pSearchPath);
                            }
                        } else {
                            reqInstanceHelper.PrintInfo(serviceName, 'Accessing Default ' + fxConnString, tmpFxTranObjLogInfo);
                            var defaultRedisKey = (fxConnString + '~' + defaultRoutingKey).toUpperCase();
                            if (IsTransactionScope) {
                                keySpaceValues = mTranSessionValuesWithTrx[(fxConnString + '~' + defaultRoutingKey).toUpperCase()].Connection;
                                if (keySpaceValues && keySpaceValues[pSearchPath]) {
                                    tranDB.DBConn = {
                                        Connection: keySpaceValues[pSearchPath],
                                        Orm: mTranSessionValuesWithTrx[(fxConnString + '~' + defaultRoutingKey).toUpperCase()].Orm,
                                        DBType: mTranSessionValuesWithTrx[(fxConnString + '~' + defaultRoutingKey).toUpperCase()].DBType
                                    };
                                    reqKnexHelper.GetTransactionScope(tranDB.DBConn.Connection, function (trx) {
                                        try {
                                            tranDB.trx = trx;
                                            return sendResult(tranDB);
                                        } catch (error) {
                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-241052', 'Error in getFXTranDBConn function', error);
                                        }
                                    });
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Connecting default ' + fxConnString, tmpFxTranObjLogInfo);
                                    createInstancesOnRuntime(defaultRedisKey, function (pResult) {
                                        try {
                                            if (pResult.status == 'SUCCESS') {
                                                keySpaceValues = mTranSessionValuesWithTrx[defaultRedisKey.toUpperCase()].Connection;
                                                tranDB.DBConn = {
                                                    Connection: keySpaceValues[pSearchPath],
                                                    Orm: mTranSessionValuesWithTrx[defaultRedisKey.toUpperCase()].Orm,
                                                    DBType: mTranSessionValuesWithTrx[defaultRedisKey.toUpperCase()].DBType
                                                };
                                                reqKnexHelper.GetTransactionScope(tranDB.DBConn.Connection, function (trx) {
                                                    try {
                                                        tranDB.trx = trx;
                                                        return sendResult(tranDB);
                                                    } catch (error) {
                                                        reqInstanceHelper.PrintError(serviceName, tmpFxTranObjLogInfo, 'ERR-KNEX-241051', 'Error in getFXTranDBConn function', error);
                                                    }
                                                });
                                            }
                                        } catch (error) {
                                            reqInstanceHelper.PrintError(serviceName, tmpFxTranObjLogInfo, 'ERR-KNEX-241050', 'Error in getFXTranDBConn function', error);
                                        }
                                    }, pSearchPath);
                                }
                            } else {
                                keySpaceValues = mTranSessionValues[(fxConnString + '~' + defaultRoutingKey).toUpperCase()] ? mTranSessionValues[(fxConnString + '~' + defaultRoutingKey).toUpperCase()].Connection : null;
                                if (keySpaceValues && keySpaceValues[pSearchPath]) {
                                    reqInstanceHelper.PrintInfo(serviceName, 'default' + fxConnString + ' key available', tmpFxTranObjLogInfo);
                                    tranDB.DBConn = {
                                        Connection: keySpaceValues[pSearchPath],
                                        Orm: mTranSessionValues[(fxConnString + '~' + defaultRoutingKey).toUpperCase()].Orm,
                                        DBType: mTranSessionValues[(fxConnString + '~' + defaultRoutingKey).toUpperCase()].DBType
                                    };
                                    tranDB.trx = null;
                                    return sendResult(tranDB);
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Connecting default ' + fxConnString, tmpFxTranObjLogInfo);
                                    createInstancesOnRuntime(defaultRedisKey, function (pResult) {
                                        try {
                                            if (pResult.status == 'SUCCESS') {
                                                keySpaceValues = mTranSessionValues[defaultRedisKey.toUpperCase()].Connection;
                                                tranDB.DBConn = {
                                                    Connection: keySpaceValues[pSearchPath],
                                                    Orm: mTranSessionValues[defaultRedisKey.toUpperCase()].Orm,
                                                    DBType: mTranSessionValues[defaultRedisKey.toUpperCase()].DBType
                                                };
                                                tranDB.trx = null;
                                                return sendResult(tranDB);
                                            }
                                        } catch (error) {
                                            reqInstanceHelper.PrintError(serviceName, tmpFxTranObjLogInfo, 'ERR-KNEX-241049', 'Error in getFXTranDBConn function', error);
                                        }
                                    }, pSearchPath);
                                }
                            }
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, tmpFxTranObjLogInfo, 'ERR-KNEX-241048', 'Error in getFXTranDBConn function', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, tmpFxTranObjLogInfo, 'ERR-KNEX-241047', 'Error in getFXTranDBConn function', error);
            }
        });
        function sendResult(result) {
            reqInstanceHelper.PrintInfo(serviceName, 'GetFXTranDBConn End', tmpFxTranObjLogInfo);
            result.DBConn.Connection.schemaName = pSearchPath; //for cache
            return callback(result);
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, tmpFxTranObjLogInfo, 'ERR-KNEX-241046', 'Error in getFXTranDBConn function', error);
    }
}

module.exports = {
    CreateTranDBInstance: CreateTranDBInstance,
    Disconnect: Disconnect,
    GetTableFromTranDB: GetTableFromTranDB,
    InsertTranDB: InsertTranDB,
    InsertBulkTranDB: InsertBulkTranDB,
    UpdateTranDB: UpdateTranDB,
    DeleteTranDB: DeleteTranDB,
    ExecuteSQLQuery: ExecuteSQLQuery,
    ExecuteQueryWithPagingCount: ExecuteQueryWithPagingCount,
    ExecuteProcedure: ExecuteProcedure,
    CreateInstancesOnRuntime: createInstancesOnRuntime,
    GetTranDBConn: getTranDBConn,
    TranInsertUpdate: tranInsertUpdate,
    DeleteMulti: deleteMulti,
    TranDeleteUpdate: tranDeleteUpdate,
    Commit: commit,
    CheckAllTranDBAvail: checkAllTranDBAvail,
    CreateFxDBInstance: createFxDBInstance,
    LoadFxDBClient: loadFxDBClient,
    LoadTranDBClient: loadTranDBClient,
    GetFXTranDBConn: getFXTranDBConn,
    CallRollback: callRollback
}
/********* End of File *************/