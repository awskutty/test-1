/*
  @Decsription      : To handle transaction db operations
  @Last Error Code  : 'ERR-KNEX-231107'
  @Last modified for: Make single connection for every api call
*/

// Require dependencies
var reqInstanceHelper = require('../common/InstanceHelper');
var reqKnexHelper = require('./db/KnexHelper');
var reqEncryptionInstance = require('../common/crypto/EncryptionInstance');
var fs = require('fs')

var tranDBClient = 'pg';
var mOrm = 'knex'; //change it soon
var connString = 'TRANDB';
var fxConnString = 'POSTGRES';
var fxDBClient = 'pg';
var mTranSessionValues = {};
var mTranSessionValuesWithTrx = {};
var arrConnectedServers = [];
var defaultRoutingKey = 'clt-0~app-0~tnt-0~env-0';
var serviceName = 'TranDBInstance';
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

function CreateTranDBInstance(pOrm, pRedisKey, pVal, pLogInfo, pCallback) {
    try {
        reqInstanceHelper.PrintInfo(serviceName, 'CreateTranDBInstance function called.', pLogInfo);
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
                    };
                    break;
                case 'oracledb':
                    conn = {
                        user: tranDBConfig.UserID,
                        password: strEncPwd,
                        connectString: '//' + tranDBConfig.Server + ':' + tranDBConfig.Port + '/' + tranDBConfig.Database
                    };
                    break;
                default:
                    break;
            }

            // To handle SSL connection
            if (tranDBConfig.SSL) {
                var dbSSL = {};
                if (tranDBConfig.SSL.CA_PATH) {
                    dbSSL['ca'] = fs.readFileSync(tranDBConfig.SSL.CA_PATH).toString()
                }
                if (tranDBConfig.SSL.KEY_PATH) {
                    dbSSL['key'] = fs.readFileSync(tranDBConfig.SSL.KEY_PATH).toString()
                }
                if (tranDBConfig.SSL.CERT_PATH) {
                    dbSSL['cert'] = fs.readFileSync(tranDBConfig.SSL.CERT_PATH).toString()
                }
                if (Object.keys(dbSSL).length) {
                    dbSSL.rejectUnauthorized = false
                    conn.ssl = dbSSL
                }
            } else if (process.env.need_db_ssl && process.env.need_db_ssl == 'Y') {
                conn.ssl = {
                    rejectUnauthorized: false
                }
            }

            reqInstanceHelper.PrintInfo(serviceName, 'GetKnexConnection function called.', pLogInfo);
            reqKnexHelper.GetKnexConnection(tranDBClient.toLowerCase(), conn, tranDBConfig.SearchPath, tranDBConfig.Pool, pLogInfo, function callback(error, knexConn, knexConnForTrx, pDBType) {
                try {
                    if (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231105', 'FAILURE for ' + pRedisKey, error);
                        // return
                        pCallback(error);
                        doConnect(pRedisKey);
                    } else {
                        var result = {};
                        result.status = 'SUCCESS';
                        result.Connection = knexConn;
                        result.DBType = pDBType;
                        result.Orm = mOrm;
                        result.routingkey = pRedisKey.replace(connString + '~', '').toLowerCase();
                        return pCallback(result);
                    }
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231104', 'Error in CreateTranDBInstance function', error);
                }
            });
            // }
        } else if (pOrm == 'something') { //change  it soon

        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231103', 'Error in CreateTranDBInstance function', error);
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
                            if (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                            }
                            reqKnexHelper.DestroyKnexConnection(mTranSessionValuesWithTrx[redisKey].Connection[schema], function (error, result) {
                                try {
                                    if (error) {
                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                                    }
                                    reqInstanceHelper.PrintInfo(serviceName, currentKey + '.....Disconnected.', null);
                                    if (i < arrConnectedServers.length) {
                                        doDisconnect(arrConnectedServers[i].keyName);
                                    } else {
                                        mTranSessionValues = {};
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
                    });
                } else {
                    reqKnexHelper.DestroyKnexConnection(mTranSessionValues[currentKey].Connection, function (error, result) {
                        try {
                            if (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                            }
                            reqKnexHelper.DestroyKnexConnection(mTranSessionValuesWithTrx[currentKey].Connection, function (error, result) {
                                try {
                                    if (error) {
                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                                    }
                                    reqInstanceHelper.PrintInfo(serviceName, currentKey + '.....Disconnected.', null);
                                    if (i < arrConnectedServers.length) {
                                        doDisconnect(arrConnectedServers[i].keyName);
                                    } else {
                                        mTranSessionValues = {};
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
        if (pSession && pSession.DBConn) {
            if (pSession.DBConn.Orm == 'knex') {
                reqKnexHelper.Insert(pSession.DBConn.Connection, pSession.trx, pTableName, pRows, pLogInfo, pSession.DBConn.DBType, function (pResult, pError) {
                    try {
                        pTableName = null;
                        pRows = null;
                        pCallback(pResult, pError);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231102', 'Error in InsertTranDBWithAudit function', error);
                    }
                });
            } else if (pSession.DBConn.Orm == 'something') {

            }
        } else {
            pCallback(null, 'DB Connection error');
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231101', 'Error in InsertTranDBWithAudit function', error);
    }
}


// this is for insert by orm
function InsertTranDBWithAudit(pSession, pTableName, pRows, pLogInfo, pCallback) {
    try {
        if (pSession && pSession.DBConn) {
            if (pSession.DBConn.Orm == 'knex') {
                reqKnexHelper.InsertwithAudit(pSession.DBConn.Connection, pSession.trx, pTableName, pRows, pLogInfo, pSession.DBConn.DBType, function (pResult, pError) {
                    try {
                        pTableName = null;
                        pRows = null;
                        pCallback(pResult, pError);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231102', 'Error in InsertTranDBWithAudit function', error);
                    }
                });
            } else if (pSession.DBConn.Orm == 'something') {

            }
        } else {
            pCallback(null, 'DB Connection error');
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231101', 'Error in InsertTranDBWithAudit function', error);
    }
}

// this is for bulk insert by orm
function InsertBulkTranDB(pSession, pTableName, pRows, pLogInfo, pChunckSize, pCallback) {
    try {
        if (pSession && pSession.DBConn) {
            if (pSession.DBConn.Orm == 'knex') {
                reqKnexHelper.InsertBulk(pSession.DBConn.Connection, pSession.trx, pTableName, pRows, pLogInfo, pSession.DBConn.DBType, pChunckSize, function (pResult, pError) {
                    try {
                        pCallback(pResult, pError);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231102', 'Error in InsertTranDBWithAudit function', error);
                    }
                });
            } else if (pSession.DBConn.Orm == 'something') {

            }
        } else {
            pCallback(null, "DB COnnection error");
        }

    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231101', 'Error in InsertTranDBWithAudit function', error);
    }
}

// this is for bulk insert by orm
function InsertBulkTranDBWithAudit(pSession, pTableName, pRows, pLogInfo, pChunckSize, pCallback) {
    try {
        if (pSession && pSession.DBConn) {
            if (pSession.DBConn.Orm == 'knex') {
                reqKnexHelper.InsertBulkWithAudit(pSession.DBConn.Connection, pSession.trx, pTableName, pRows, pLogInfo, pSession.DBConn.DBType, pChunckSize, function (pResult, pError) {
                    try {
                        pCallback(pResult, pError);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231102', 'Error in InsertTranDBWithAudit function', error);
                    }
                });
            } else if (pSession.DBConn.Orm == 'something') {

            }
        } else {
            pCallback(null, "DB COnnection error");
        }

    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231101', 'Error in InsertTranDBWithAudit function', error);
    }
}

// this is for select by orm
function GetTableFromTranDB(pSession, pTableName, pCond, pLogInfo, pCallback) {
    try {
        var headers = {
            routingkey: pSession.DBConn.routingkey
        };
        if (pSession && pSession.DBConn) {
            if (pSession.DBConn.Orm == 'knex') {
                reqKnexHelper.List(headers, pSession.DBConn.Connection, pSession.trx, pTableName, pCond, pLogInfo, pSession.DBConn.DBType, function (pResult, pError) {
                    try {
                        pCallback(pResult, pError);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231100', 'Error in GetTableFromTranDB function', error);
                    }
                });
            } else if (pSession.DBConn.Orm == 'something') {

            }
        } else {
            pCallback(null, "DB Conection error");
        }

    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231099', 'Error in GetTableFromTranDB function', error);
    }
}


// this is for select by orm NoCache
function GetTableFromTranDBNoCache(pSession, pTableName, pCond, pLogInfo, pCallback) {
    try {
        var headers = {
            routingkey: pSession.DBConn.routingkey
        };
        if (pSession && pSession.DBConn) {
            if (pSession.DBConn.Orm == 'knex') {
                reqKnexHelper.ListWithoutCache(headers, pSession.DBConn.Connection, pSession.trx, pTableName, pCond, pLogInfo, pSession.DBConn.DBType, function (pResult, pError) {
                    try {
                        pCallback(pResult, pError);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231100', 'Error in GetTableFromTranDB function', error);
                    }
                });
            } else if (pSession.DBConn.Orm == 'something') {

            }
        } else {
            pCallback(null, "DB Conection error");
        }

    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231099', 'Error in GetTableFromTranDB function', error);
    }
}

// this is for update by orm
function UpdateTranDB(pSession, pTableName, pRows, pCond, pLogInfo, pCallback) {
    try {
        if (pSession && pSession.DBConn) {
            if (pSession.DBConn.Orm == 'knex') {
                reqKnexHelper.Update(pSession.DBConn.Connection, pSession.trx, pTableName, pRows, pCond, pLogInfo, pSession.DBConn.DBType, function (pResult, pError) {
                    try {
                        pCallback(pResult, pError);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231098', 'Error in UpdateTranDB function', error);
                    }
                });
            } else if (pSession.DBConn.Orm == 'something') {

            }
        } else {
            pCallback(null, 'DB Conecction error');
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231097', 'Error in UpdateTranDB function', error);
    }
}


// this is for update by orm
function UpdateTranDBWithAudit(pSession, pTableName, pRows, pCond, pLogInfo, pCallback) {
    try {
        if (pSession && pSession.DBConn) {
            if (pSession.DBConn.Orm == 'knex') {
                reqKnexHelper.UpdateWithAudit(pSession.DBConn.Connection, pSession.trx, pTableName, pRows, pCond, pLogInfo, pSession.DBConn.DBType, function (pResult, pError) {
                    try {
                        pCallback(pResult, pError);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231098', 'Error in UpdateTranDB function', error);
                    }
                });
            } else if (pSession.DBConn.Orm == 'something') {

            }
        } else {
            pCallback(null, 'DB Conecction error');
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231097', 'Error in UpdateTranDB function', error);
    }
}

// this is for update by orm
function DeleteTranDB(pSession, pTableName, pCond, pLogInfo, pCallback) {
    try {
        if (pSession && pSession.DBConn) {
            if (pSession.DBConn.Orm == 'knex') {
                reqKnexHelper.Delete(pSession.DBConn.Connection, pSession.trx, pTableName, pCond, pLogInfo, pSession.DBConn.DBType, function (pResult, pError) {
                    try {
                        pCallback(pResult, pError);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231096', 'Error in DeleteTranDB function', error);
                    }
                });
            } else if (pSession.DBConn.Orm == 'something') {

            }
        } else {
            pCallback(null, "DB Connection error");
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231095', 'Error in DeleteTranDB function', error);
    }
}

function ExecuteSQLQuery(pSession, pQuery, pLogInfo, pCallback) {
    try {
        pQuery = pQuery.replaceAll(/&lt;/g, '<').replaceAll(/&gt;/g, '>');
        if (pSession && pSession.DBConn) {
            if (pSession.DBConn.Orm == 'knex') {
                reqKnexHelper.ExecuteSQLQuery(pSession.DBConn.Connection, pSession.trx, pQuery, pLogInfo, pSession.DBConn.DBType, function (pResult, pError) {
                    try {
                        pCallback(pResult, pError);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231094', 'Error in ExecuteSQLQuery function', error);
                    }
                });
            } else if (pSession.DBConn.Orm == 'something') {

            }
        } else {
            pCallback(null, 'DB Connection Error');
        }

    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231093', 'Error in ExecuteSQLQuery function', error);
    }
}

function ExecuteQueryWithPagingCount(pSession, pQuery, pPageNo, pPageSize, pLogInfo, pCallback) {
    try {
        pQuery = pQuery.replaceAll(/&lt;/g, '<').replaceAll(/&gt;/g, '>');
        if (pSession.DBConn) {
            if (pSession.DBConn.Orm == 'knex') {
                reqKnexHelper.ExecuteQueryWithPagingCount(pSession.DBConn.DBType, pSession.DBConn.Connection, pSession.trx, pQuery, pPageNo, pPageSize, pLogInfo, function (pResult, pCount, pError) {
                    try {
                        pCallback(pResult, pCount, pError);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231092', 'Error in ExecuteQueryWithPagingCount function', error);
                    }
                });
            } else if (pSession.DBConn.Orm == 'something') {

            }
        } else {
            pCallback('', '', 'DB Connection error');
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231091', 'Error in ExecuteQueryWithPagingCount function', error);
    }
}

function ExecuteProcedure(pSession, pProcedure, pBindParams, pLogInfo, pCallback) {
    try {
        if (pSession.DBConn) {
            if (pSession.DBConn.Orm == 'knex') {
                reqKnexHelper.ExecuteProcedure(pSession.DBConn.Connection, pSession.trx, pProcedure, pLogInfo, pSession.DBConn.DBType, pBindParams, function (pResult, pError) {
                    try {
                        pCallback(pResult, pError);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231106', 'Error in ExecuteProcedure function', error);
                    }
                });
            } else if (pSession.DBConn.Orm == 'something') {

            }
        } else {
            pCallback("FAILURE", "DB Connection error");
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231107', 'Error in ExecuteProcedure function', error);
    }
}

// this will return tranDB Connection
function getTranDBConn(pHeaders, IsTransactionScope, callback) {
    try {
        // mTranSessionValues = {}
        // mTranSessionValuesWithTrx = {}
        reqInstanceHelper.PrintInfo(serviceName, 'Connection Request for | TRANDB', tmpObjLogInfo);
        var sessId = "SESSIONID-" + pHeaders['session-id'];
        var NeedSysRouting = 'N';
        var sysRoutingId = '';
        var tmpObjLogInfo = pHeaders.LOG_INFO ? pHeaders.LOG_INFO : {};
        reqInstanceHelper.PrintInfo(serviceName, 'query session is' + sessId, tmpObjLogInfo);
        reqInstanceHelper.GetConfig(sessId, function (redisSession) {
            if (redisSession != 0) {
                reqInstanceHelper.PrintInfo(serviceName, 'Got the session id', tmpObjLogInfo);
                var parsedSession = JSON.parse(redisSession);
                if (parsedSession.length) {
                    NeedSysRouting = parsedSession[0].NEED_SYSTEM_ROUTING;
                    sysRoutingId = parsedSession[1].RoutingSId;
                    reqInstanceHelper.PrintInfo(serviceName, 'NEED_SYSTEM_ROUTING | ' + NeedSysRouting, tmpObjLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, 'SYSTEM ROUTING SID | ' + sysRoutingId, tmpObjLogInfo);
                }
            }
            reqInstanceHelper.PrintInfo(serviceName, 'GetTranDBConn Begin', tmpObjLogInfo);
            //IsTransactionScope = false;
            if (!pHeaders) {
                pHeaders = {};
            }
            var reqDBInstance = require('./DBInstance');
            var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
            loadFxDBClient(serviceModel);
            loadTranDBClient(serviceModel);
            var tranDB = new Object();
            reqInstanceHelper.PrintInfo(serviceName, 'routingkey ==== ' + pHeaders['routingkey'], tmpObjLogInfo);
            reqInstanceHelper.GetRedisKey(connString, pHeaders['routingkey'], function (redisKey) {
                try {
                    var TranRouting = redisKey;
                    if (NeedSysRouting == 'Y') {
                        TranRouting = TranRouting + '~' + sysRoutingId;
                    }

                    reqInstanceHelper.PrintInfo(serviceName, '==== Finding redisKey ==== ' + TranRouting, tmpObjLogInfo);
                    reqInstanceHelper.IsRedisKeyAvail(TranRouting, function (result) {
                        try {

                            if (!result) {
                                if (NeedSysRouting == 'Y') {
                                    reqInstanceHelper.PrintInfo(serviceName, 'System level routingkey setup missing for key - ' + TranRouting, tmpObjLogInfo);
                                    return callback('System level routingkey setup missing');
                                } else {
                                    //if rediskey not available get the connection using default routing key
                                    redisKey = (connString + '~' + defaultRoutingKey).toUpperCase();
                                    reqInstanceHelper.PrintInfo(serviceName, 'Default Routing key', tmpObjLogInfo);
                                }
                            } else {
                                redisKey = TranRouting;
                            }

                            //Create New connection for every api call
                            createInstancesOnRuntime(redisKey, tmpObjLogInfo, function (pResult) {
                                try {
                                    if (pResult.status == 'SUCCESS') {
                                        if (!tmpObjLogInfo) {
                                            tmpObjLogInfo = {};
                                        }
                                        if (tmpObjLogInfo && !tmpObjLogInfo.arrConns) {
                                            tmpObjLogInfo.arrConns = [];
                                        }
                                        tmpObjLogInfo.arrConns.push(pResult.Connection);
                                        if (IsTransactionScope) {
                                            tranDB.DBConn = pResult;
                                            reqInstanceHelper.PrintInfo(serviceName, 'Getting transaction Scope', tmpObjLogInfo);
                                            reqKnexHelper.GetTransactionScope(tranDB.DBConn.Connection, tmpObjLogInfo, function (trx) {
                                                try {
                                                    reqInstanceHelper.PrintInfo(serviceName, 'Get transaction Scope | done', tmpObjLogInfo);
                                                    tranDB.trx = trx;
                                                    tmpObjLogInfo.arrConns.push(trx);
                                                    return sendResult(tranDB);
                                                } catch (error) {
                                                    reqInstanceHelper.PrintError(serviceName, tmpObjLogInfo, 'ERR-KNEX-231089', 'Error in getTranDBConn function', error);
                                                }
                                            });
                                        } else {
                                            var connobj = {};
                                            connobj.Orm = mOrm;
                                            connobj.DBType = pResult.DBType;
                                            connobj.Connection = pResult.Connection;
                                            tranDB.DBConn = connobj;
                                            tranDB.trx = null;
                                            return sendResult(tranDB);
                                        }
                                    } else {
                                        return sendResult(null);
                                    }
                                } catch (error) {
                                    reqInstanceHelper.PrintError(serviceName, tmpObjLogInfo, 'ERR-KNEX-231088', 'Error in getTranDBConn function', error);
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, tmpObjLogInfo, 'ERR-KNEX-231083', 'Error in getTranDBConn function', error);
                        }
                    });
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, tmpObjLogInfo, 'ERR-KNEX-231082', 'Error in getTranDBConn function', error);
                }
            });
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, tmpObjLogInfo, 'ERR-KNEX-231081', 'Error in getTranDBConn function', error);
    }

    function sendResult(session) {
        reqInstanceHelper.PrintInfo(serviceName, 'GetTranDBConn End', tmpObjLogInfo);
        if (!session) {
            reqInstanceHelper.PrintInfo(serviceName, 'connection in error state', tmpObjLogInfo);
            return callback(session); //it's null
        } else {
            CheckTranDBAvail(session, tmpObjLogInfo, function (result) {
                if (result == 'SUCCESS') {
                    reqInstanceHelper.PrintInfo(serviceName, 'connection status - Connected', tmpObjLogInfo);
                    return callback(session);
                } else {
                    reqInstanceHelper.PrintInfo(serviceName, 'connection status - Not connected', tmpObjLogInfo);
                }
            });
        }
    }
}

function pushConnectionToArray(pKey, pConn) {
    try {
        var obj = {};
        obj.keyName = pKey;
        obj.conn = JSON.stringify(pConn);
        arrConnectedServers.push(obj);
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231080', 'Error in pushConnectionToArray function', error);
    }
}

// this will initiate to load connections for this service in runtime
function createInstancesOnRuntime(pRedisKey, pLogInfo, callback, pSearchPath) {
    try {
        reqInstanceHelper.PrintInfo(serviceName, 'createInstancesOnRuntime function called.', pLogInfo);
        reqInstanceHelper.GetConfig(pRedisKey, function (pConf) {
            try {
                reqInstanceHelper.PrintInfo(serviceName, 'GetConfig End.', pLogInfo);
                var objResult = JSON.parse(pConf);
                if (pRedisKey.indexOf(connString) > -1) {
                    CreateTranDBInstance(mOrm, pRedisKey, objResult, pLogInfo, function (pResult) {
                        try {
                            global.ISTranDestroyed = false;
                            return callback(pResult);
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231079', 'Error in createInstancesOnRuntime function', error);
                        }
                    });
                } else {
                    reqInstanceHelper.PrintInfo(serviceName, 'createFxDBInstance going to call.', pLogInfo);
                    createFxDBInstance(mOrm, pRedisKey, objResult, pLogInfo, function (pResult) {
                        try {
                            reqInstanceHelper.PrintInfo(serviceName, 'createFxDBInstance callback going to call.', pLogInfo);
                            return callback(pResult);
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231078', 'Error in createInstancesOnRuntime function', error);
                        }
                    }, pSearchPath);
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231077', 'Error in createInstancesOnRuntime function', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231076', 'Error in createInstancesOnRuntime function', error);
    }
}

function tranInsertUpdate(pSession, arrTableDetails, callback) {
    try {
        if (pSession.DBConn) {
            if (pSession.DBConn.Orm == 'knex') {
                reqKnexHelper.KnexTranInsertUpdate(pSession.DBConn.Connection, pSession.trx, arrTableDetails, pSession.DBConn.DBType, function (result) {
                    try {
                        callback(result);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231075', 'Error in tranInsertUpdate function', error);
                    }
                });
            } else if (pSession.DBConn.Orm == 'something') {

            }
        } else {
            callback('DB Connection error');
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231074', 'Error in tranInsertUpdate function', error);
    }
}

function deleteMulti(pSession, pObjTableDeleteDetails, callback) {
    try {
        if (pSession.DBConn) {
            if (pSession.DBConn.Orm == 'knex') {
                reqKnexHelper.KnexDeleteMulti(pSession.DBConn.Connection, pObjTableDeleteDetails, pSession.DBConn.DBType, function (result) {
                    try {
                        callback(result);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231073', 'Error in deleteMulti function', error);
                    }
                });
            } else if (pSession.DBConn.Orm == 'something') {

            }
        } else {
            callback("Db Connection error");
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231072', 'Error in deleteMulti function', error);
    }
}

function tranDeleteUpdate(pSession, arrTableDetails, callback) {
    try {
        if (pSession.DBConn) {
            if (pSession.DBConn.Orm == 'knex') {
                reqKnexHelper.KnexTranDeleteUpdate(pSession.DBConn.Connection, pSession.trx, arrTableDetails, pSession.DBConn.DBType, function (result) {
                    try {
                        callback(result);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231071', 'Error in tranDeleteUpdate function', error);
                    }
                });
            } else if (pSession.DBConn.Orm == 'something') {

            }
        } else {
            callback('DB Connection error');
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231070', 'Error in tranDeleteUpdate function', error);
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
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231069', 'Error in addToTranDBSession function', error);
    }
}

function callRollback(pSession) {
    if (pSession && pSession.trx) {
        commit(pSession, false, function (result) {
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231068', 'Trx closed (Rollback) on Response end event', null);
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
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231067', 'Error in commit function', error);
                }
            });

        } else if (pSession.DBConn.Orm == 'something') {

        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231066', 'Error in commit function', error);
    }
}

var arrDoConnect = [];
var arrRetryingKeys = [];

function doConnect(redisKey) {
    try {
        function callback(result) {
            try {
                if (result && result.status == 'SUCCESS') {
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
                } else {
                    reqInstanceHelper.PrintInfo(serviceName, ' doconnect callback', null);
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231065', 'Error in doConnect function', error);
            }
        }
        reqInstanceHelper.PrintInfo(serviceName, ' doconnect called for key | ' + redisKey, null);
        if (arrRetryingKeys.indexOf(redisKey, 0) > -1) {
            reqInstanceHelper.PrintInfo(serviceName, redisKey + ' Already Retrying.', null);
        } else {
            reqInstanceHelper.PrintInfo(serviceName, redisKey + ' Initiated Retrying.', null);
            var interval = setInterval(createInstancesOnRuntime, 15000, redisKey, objLogInfo, callback);
            var obj = {};
            obj.redisKey = redisKey;
            obj.interval = interval;
            arrRetryingKeys.push(redisKey);
            arrDoConnect.push(obj);
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231064', 'Error in doConnect function', error);
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
                            CheckTranDBAvail(pSession, '', function (result) {
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
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231063', 'Error in checkAllTranDBAvail function', error);
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231062', 'Error in checkAllTranDBAvail function', error);
                        }
                    });
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231061', 'Error in checkAllTranDBAvail function', error);
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
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231060', 'Error in checkAllTranDBAvail function', error);
    }
}

function CheckTranDBAvail(pSession, pLogInfo, callback) {
    try {
        reqInstanceHelper.PrintInfo(serviceName, 'Check Connection availabllity ', pLogInfo);
        if (pSession.DBConn.Orm == 'knex') {
            reqKnexHelper.CheckConnection(pSession.DBConn.DBType, pSession.DBConn.Connection, pLogInfo, function (result) {
                reqInstanceHelper.PrintInfo(serviceName, 'Connection availablity |' + result, pLogInfo);
                return callback(result);
            });
        } else if (pSession.DBConn.Orm == 'something') {

        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231059', 'Error in CheckTranDBAvail function', error);
    }
}

function createFxDBInstance(pOrm, pRedisKey, pVal, pLogInfo, pCallback, pSearchPath) {
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
                        };
                    } else if (fxConnString.toUpperCase() == 'POSTGRES') {
                        schemas = tranDBConfig.PostgresSchemas;
                        conn = {
                            host: tranDBConfig.Server,
                            port: tranDBConfig.Port,
                            user: tranDBConfig.UserID,
                            password: strEncPwd,
                            database: tranDBConfig.Database
                        };
                        if (tranDBConfig.SSL) {
                            var dbSSL = {};
                            if (tranDBConfig.SSL.CA_PATH) {
                                dbSSL['ca'] = fs.readFileSync(tranDBConfig.SSL.CA_PATH).toString()
                            }
                            if (tranDBConfig.SSL.KEY_PATH) {
                                dbSSL['key'] = fs.readFileSync(tranDBConfig.SSL.KEY_PATH).toString()
                            }
                            if (tranDBConfig.SSL.CERT_PATH) {
                                dbSSL['cert'] = fs.readFileSync(tranDBConfig.SSL.CERT_PATH).toString()
                            }
                            if (Object.keys(dbSSL).length) {
                                dbSSL.rejectUnauthorized = false
                                conn.ssl = dbSSL
                            }
                        } else if (process.env.need_db_ssl && process.env.need_db_ssl == 'Y') {
                            conn.ssl = {
                                rejectUnauthorized: false
                            }
                        }
                    } else if (fxConnString.toUpperCase() == 'MYSQL') {
                        schemas = tranDBConfig.MysqlSchemas;
                        conn = {
                            host: tranDBConfig.Server,
                            port: tranDBConfig.Port,
                            user: tranDBConfig.UserID,
                            password: strEncPwd,
                            database: tranDBConfig.Database
                        };
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
                    ConnectToPg(schemas[j]);

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

                            reqInstanceHelper.PrintInfo(serviceName, 'GetKnexConnection going to call.', pLogInfo);
                            reqKnexHelper.GetKnexConnection(fxDBClient.toLowerCase(), conn, searchPath, tranDBConfig.Pool, pLogInfo, function callback(error, knexConn, knexConnForTrx, pDBType) {
                                try {
                                    if (error) {
                                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231058', 'FAILURE for ' + pRedisKey, error);
                                        // doConnect(pRedisKey);
                                        pCallback(error);
                                        doConnect(pRedisKey);
                                    } else {
                                        var result = {};
                                        result.status = 'SUCCESS';
                                        result.Connection = knexConn;
                                        result.DBType = pDBType;
                                        result.routingkey = pRedisKey.replace(connString + '~', '').toLowerCase();
                                        return pCallback(result);
                                    }
                                } catch (error) {
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231057', 'Error in createFxDBInstance function', error);
                                }
                            });
                            // }
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231108', 'Error in createFxDBInstance function', error);
                        }
                    }
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231109', 'Error in createFxDBInstance function', error);
                }
            }
        } else if (pOrm == 'something') { //change it soon

        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231056', 'Error in createFxDBInstance function', error);
        return pCallback('FAILURE');
    }
}

function getFXTranDBConn(pHeaders, pSearchPath, IsTransactionScope, callback) {
    try {
        var tmpFxTranObjLogInfo = pHeaders.LOG_INFO ? pHeaders.LOG_INFO : {};
        reqInstanceHelper.PrintInfo(serviceName, 'Connection Request for | TRANDB', tmpFxTranObjLogInfo);
        reqInstanceHelper.PrintInfo(serviceName, 'GetFXTranDBConn Begin', tmpFxTranObjLogInfo);
        var sessId = "SESSIONID-" + pHeaders['session-id'];
        var NeedSysRouting = 'N';
        var sysRoutingId = '';
        reqInstanceHelper.PrintInfo(serviceName, 'query session is' + sessId, tmpFxTranObjLogInfo);
        reqInstanceHelper.GetConfig(sessId, function (redisSession) {
            if (redisSession != 0) {
                reqInstanceHelper.PrintInfo(serviceName, 'Got the session id', tmpFxTranObjLogInfo);
                var parsedSession = JSON.parse(redisSession);
                if (parsedSession.length) {
                    NeedSysRouting = parsedSession[0].NEED_SYSTEM_ROUTING;
                    sysRoutingId = parsedSession[1].RoutingSId;
                    reqInstanceHelper.PrintInfo(serviceName, 'NEED_SYSTEM_ROUTING | ' + NeedSysRouting, tmpFxTranObjLogInfo);
                    reqInstanceHelper.PrintInfo(serviceName, 'SYSTEM ROUTING SID | ' + sysRoutingId, tmpFxTranObjLogInfo);
                }
            }
            //IsTransactionScope = false;
            var reqDBInstance = require('./DBInstance');
            var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
            loadFxDBClient(serviceModel);
            loadTranDBClient(serviceModel);
            var tranDB = new Object();
            reqInstanceHelper.PrintInfo(serviceName, 'routingkey ==== ' + pHeaders['routingkey'], tmpFxTranObjLogInfo);
            var routingkey = pHeaders['routingkey'];
            if (NeedSysRouting == 'Y') {
                reqInstanceHelper.PrintInfo(serviceName, "System Routing setup available ===== ", tmpFxTranObjLogInfo);
                if (pSearchPath == 'res_cas' || pSearchPath == 'dep_cas' || pSearchPath == 'log_cas') {
                    routingkey = routingkey + '~' + sysRoutingId;
                    reqInstanceHelper.PrintInfo(serviceName, "System Routing key is " + routingkey, tmpFxTranObjLogInfo);
                }
            }
            reqInstanceHelper.GetRedisKey(fxConnString, routingkey, function (redisKey) {
                try {
                    reqInstanceHelper.PrintInfo(serviceName, 'Finding redisKey ==== ' + redisKey, tmpFxTranObjLogInfo);
                    var keySpaceValues;
                    reqInstanceHelper.IsRedisKeyAvail(redisKey, function (result) {
                        try {
                            if (result) {

                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'Accessing Default ' + fxConnString, tmpFxTranObjLogInfo);
                                redisKey = (fxConnString + '~' + defaultRoutingKey).toUpperCase();
                            }

                            createInstancesOnRuntime(redisKey, tmpFxTranObjLogInfo, function (pResult) {
                                try {
                                    if (pResult && pResult.status == 'SUCCESS') {
                                        if (!tmpFxTranObjLogInfo) {
                                            tmpFxTranObjLogInfo = {};
                                        }
                                        if (tmpFxTranObjLogInfo && !tmpFxTranObjLogInfo.arrConns) {
                                            tmpFxTranObjLogInfo.arrConns = [];
                                        }
                                        tmpFxTranObjLogInfo.arrConns.push(pResult.Connection);
                                        if (IsTransactionScope) {
                                            //keySpaceValues = mTranSessionValuesWithTrx[redisKey.toUpperCase()].Connection;
                                            tranDB.DBConn = {
                                                Connection: pResult.Connection,
                                                Orm: mOrm,
                                                DBType: pResult.DBType
                                            };
                                            reqKnexHelper.GetTransactionScope(tranDB.DBConn.Connection, tmpFxTranObjLogInfo, function (trx) {
                                                try {
                                                    tranDB.trx = trx;
                                                    tmpFxTranObjLogInfo.arrConns.push(trx);
                                                    return sendResult(tranDB);
                                                } catch (error) {
                                                    reqInstanceHelper.PrintError(serviceName, tmpFxTranObjLogInfo, 'ERR-KNEX-231054', 'Error in getFXTranDBConn function', error);
                                                }
                                            });
                                        } else {
                                            // keySpaceValues = mTranSessionValues[redisKey.toUpperCase()].Connection;
                                            tranDB.DBConn = {
                                                Connection: pResult.Connection,
                                                Orm: mOrm,
                                                DBType: pResult.DBType
                                            };
                                            tranDB.trx = null;
                                            return sendResult(tranDB);
                                        }
                                    } else {
                                        return sendResult(null);
                                    }
                                } catch (error) {
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231053', 'Error in getFXTranDBConn function', error);
                                }
                            }, pSearchPath);

                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, tmpFxTranObjLogInfo, 'ERR-KNEX-231048', 'Error in getFXTranDBConn function', error);
                        }
                    });
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, tmpFxTranObjLogInfo, 'ERR-KNEX-231047', 'Error in getFXTranDBConn function', error);
                }
            });

            //For FxTranDB Connection 
            function sendResult(result) {
                reqInstanceHelper.PrintInfo(serviceName, 'GetFXTranDBConn End', tmpFxTranObjLogInfo);
                if (!result) {
                    return callback(null); //it's null
                } else if (result.DBConn && !result.DBConn.Connection) {
                    return callback(null);
                } else {
                    try {
                        CheckTranDBAvail(result, tmpFxTranObjLogInfo, function (ConRes) {
                            if (ConRes == 'SUCCESS') {
                                reqInstanceHelper.PrintInfo(serviceName, 'connection status - Connected', tmpFxTranObjLogInfo);
                                result.DBConn.Connection.schemaName = pSearchPath; //for cache   
                                return callback(result);
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'connection status - Not Connected', tmpFxTranObjLogInfo);
                                console.log('Going to call Disconnect Function');
                                callback(null);
                            }
                        });
                    } catch (error) {
                        reqInstanceHelper.PrintInfo(serviceName, 'Reconnecting due to connection problem...' + error, tmpFxTranObjLogInfo);
                        callback(null);
                    }
                }
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, tmpFxTranObjLogInfo, 'ERR-KNEX-231046', 'Error in getFXTranDBConn function', error);
    }
}

function ExecuteSQLQueryWithParams(pSession, pQuery, pLogInfo, pCallback) {
    try {
        if (pSession && pSession.DBConn.Orm == 'knex') {
            reqKnexHelper.ExecuteSQLQueryWithParams(pSession.DBConn.Connection, pSession.trx, pQuery, pLogInfo, pSession.DBConn.DBType, function (pResult, pError) {
                try {
                    pCallback(pResult, pError);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-987000', 'Error in ExecuteSQLQueryWithParams function', error);
                }
            });
        } else if (pSession && pSession.DBConn.Orm == 'something') {

        } else {
            pCallback(null, "DB Conection error");
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-987001', 'Error in ExecuteSQLQueryWithParams function', error);
    }
}


function GetRedisKeyConfig(pHeader, redisKeyPrefix, isDefaultKey, pObjLogInfo, GetRedisKeyConfigCB) {
    try {
        var redisKey = '';
        if (isDefaultKey) {
            redisKey = redisKeyPrefix + pHeader;
        } else {
            redisKey = redisKeyPrefix + (pHeader.routingKey || pHeader.routingkey);
        }
        reqInstanceHelper.GetConfig(redisKey, function (pStrTranDBConfig, error) {
            if (error) {
                reqInstanceHelper.PrintInfo(serviceName, 'Error while Getting data For this Redis Key - ' + redisKey, pObjLogInfo);
                reqInstanceHelper.PrintInfo(serviceName, 'Error - ' + error, pObjLogInfo);
                GetRedisKeyConfigCB(null, error);
            } else if (!pStrTranDBConfig) {
                if (!isDefaultKey) {
                    reqInstanceHelper.PrintInfo(serviceName, 'There is No Data Found For this Redis Key - ' + redisKey, pObjLogInfo);
                    var defaultRoutingKey = 'CLT-0~APP-0~TNT-0~ENV-0';
                    reqInstanceHelper.PrintInfo(serviceName, 'Then Get the Config With Default Routing Key - ' + defaultRoutingKey, pObjLogInfo);
                    GetRedisKeyConfig(defaultRoutingKey, redisKeyPrefix, true, pObjLogInfo, GetRedisKeyConfigCB);
                } else {
                    reqInstanceHelper.PrintInfo(serviceName, 'There is No Data For this Default Routing Key - ' + redisKey, pObjLogInfo);
                    GetRedisKeyConfigCB(null, 'There is No DB Type For this Default Routing Key - ' + redisKey);
                }
            } else {
                GetRedisKeyConfigCB(pStrTranDBConfig, null);
            }
        });

    } catch (error) {
        reqInstanceHelper.PrintInfo(serviceName, 'Error while Getting Redis Key Config', pObjLogInfo);
        reqInstanceHelper.PrintInfo(serviceName, 'Error - ' + error, pObjLogInfo);
        GetRedisKeyConfigCB(null, error);
    }
}


function GetDecryptedDataFromDB(pSession, pEncData, objLogInfo) {
    return new Promise(async (resolve, reject) => {
        try {
            var DbType = pSession.DBConn.DBType;
            if (DbType == 'pg') {
                await SetSearchPathPg(pSession, ['tran_db', 'clt_cas', 'dep_cas'], objLogInfo);
                var query = `select * from fn_pcidss_decrypt('${pEncData}', $PCIDSS_KEY) as data`;
                ExecuteSQLQuery(pSession, query, objLogInfo, function (pResult, pError) {
                    if (pError) {
                        reject(pError)
                    } else {
                        resolve(pResult)
                    }
                })
            } else {
                resolve(pEncData)
            }
        } catch (error) {
            reject(error)
        }
    })
}

// To get the schema details beloging to requested routingkey, from objLogInfo
// call knexhelper function 
function GetSchemaDetail(pDBType, pLogInfo) {
    return new Promise(async (resolve, reject) => {
        try {
            var schDtl = await reqKnexHelper.GetSchemaDetail(pDBType, pLogInfo)
            resolve(schDtl)
        } catch (error) {
            reject(error)
        }
    })
}


function SetSearchPathPg(pSession, search_path, pLogInfo) {
    return new Promise(async (resolve, reject) => {
        try {
            var pDBType = pSession.DBConn.DBType
            var SchemaDeatils = await GetSchemaDetail(pDBType, pLogInfo);
            var strSearchPath = ''
            for (var i = 0; i < search_path.length; i++) {
                if (SchemaDeatils[search_path[i]]) {
                    if (strSearchPath) {
                        strSearchPath += ','
                    }
                    strSearchPath += SchemaDeatils[search_path[i]]
                }
            }
            var pQuery = `set search_path = ${strSearchPath}`
            reqKnexHelper.ExecuteSQLQuery(pSession.DBConn.Connection, pSession.trx, pQuery, pLogInfo, pSession.DBConn.DBType, function (pResult, pError) {
                if (pError) {
                    reject(pError)
                } else {
                    resolve("SUCCESS")
                }
            })
        } catch (error) {
            reject(error)
        }
    })
}




module.exports = {
    CreateTranDBInstance: CreateTranDBInstance,
    Disconnect: Disconnect,
    GetTableFromTranDB: GetTableFromTranDB,
    InsertTranDB: InsertTranDB,
    InsertTranDBWithAudit: InsertTranDBWithAudit,
    InsertBulkTranDB: InsertBulkTranDB,
    InsertBulkTranDBWithAudit: InsertBulkTranDBWithAudit,
    UpdateTranDB: UpdateTranDB,
    UpdateTranDBWithAudit: UpdateTranDBWithAudit,
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
    CallRollback: callRollback,
    ExecuteSQLQueryWithParams: ExecuteSQLQueryWithParams,
    GetRedisKeyConfig: GetRedisKeyConfig,
    GetTableFromTranDBNoCache: GetTableFromTranDBNoCache,
    GetDecryptedDataFromDB: GetDecryptedDataFromDB,
    GetSchemaDetail: GetSchemaDetail,
    SetSearchPathPg: SetSearchPathPg
};
/********* End of File *************/