/*
  @Description: To process knex related functions,
  @Last Error Code : 'ERR-KNEX-231127' 
  @Modified for     : Common query execution with retry
*/

// Require dependencies
var reqKnex = require('knex');
var reqAsync = require('async');
var reqInstanceHelper = require('../../common/InstanceHelper');
// var reqTranDBInstance = require('../TranDBInstance');
var reqCacheRedisInstance = require('../CacheRedisInstance');
var reqEncryptionInstance = require('../../common/crypto/EncryptionInstance');
var reqDateFormatter = require('../../common/dateconverter/DateFormatter');
var reqRedisInstance = require('../../instance/RedisInstance')
// var reqSvchelper = require('../../common/serviceHelper/ServiceHelper');
var serviceName = 'KnexHelper';
var objLogInfo = null;
var cltCacheTables = ['tenant_setup'];
//For pg procedure logs
var reqEvents = require('events');
var pglogevent = new reqEvents();
var defaultRoutingKey = 'clt-0~app-0~tnt-0~env-0';
var InsertAuditColumns = [
    'CREATED_BY_NAME',
    'CREATED_CLIENTIP',
    'CREATED_DATE',
    'CREATED_BY',
    'CREATED_TZ',
    'CREATED_TZ_OFFSET',
    'CREATED_BY_SESSIONID',
    'ROUTINGKEY',
    'APP_ID',
    'CREATED_DATE_UTC',
    'TENANT_ID'
];

var ModifyAuditColumns = [
    'MODIFIED_DATE',
    'MODIFIED_BY',
    'MODIFIED_BY_NAME',
    'MODIFIED_CLIENTIP',
    'MODIFIED_TZ',
    'MODIFIED_TZ_OFFSET',
    'MODIFIED_BY_SESSIONID',
    'MODIFIED_DATE_UTC'
];

// Knex default pooling configuration - This will be applied, if settings not given on redis
var defaultPoolingFortrx = {
    "max": 10,
    "min": 0
    , "acquireTimeout": 30000
};

var defaultPooling = {
    "max": 10,
    "min": 0
    , "acquireTimeout": 30000
};


// To return the knex connection
function getKnexConnection(pClient, pConn, pSearchPath, pPool, pLogInfo, callback) {
    try {
        var apiName = ''
        if (pLogInfo.POOL) {
            pPool.min = pLogInfo.POOL.min;
            pPool.max = pLogInfo.POOL.max;
            idleTimeoutMillis = pLogInfo.idleTimeoutMillis
        }
        if (pLogInfo.SERVICEURL && pLogInfo.SERVICEURL != '-') {
            var urlparts = pLogInfo.SERVICEURL.split("/");
            if (urlparts.length) {
                apiName = pLogInfo.SERVICEURL.split("/")[urlparts.length - 1];
                if (!apiName) {
                    apiName = pLogInfo.SERVICEURL.split("/")[urlparts.length - 2];
                }
            }
        }
        pConn.application_name = process.title + (apiName ? "_" + apiName : '');
        if (pSearchPath == "maindb_public" && pClient == "pg") {
            pConn.database = "postgres";
            pSearchPath = "public";
        } else if (pSearchPath == "maindb_public" && pClient == "oracledb") {
            pSearchPath = "";
            pConn.user = (process.env.Oracle_Sys_User) ? process.env.Oracle_Sys_User : "system";
            var pConnPassword = (process.env.Oracle_Sys_Password) ? process.env.Oracle_Sys_Password : "0791c79ca20b9afa312aa062eb357dd4416dffa4d10af5bc80ec11972afcbe9b9abc653e";
            pConn.password = reqEncryptionInstance.DoDecrypt(pConnPassword);
        }
        if (pClient == 'pg') {
            try {
                // to get pg log 'notice'
                if (pPool) {
                    pPool.afterCreate = function (conn, done) {
                        conn.on('notice', function (msg) {
                            pglogevent.emit('getPgLogs', msg);
                        });
                        done('', conn);
                    };
                } else {
                    // for default pool type
                    defaultPooling.afterCreate = function (conn, done) {
                        conn.on('notice', function (msg) {
                            pglogevent.emit('getPgLogs', msg);
                        });
                        done('', conn);
                    };
                    // for default with trx pool type
                    defaultPoolingFortrx.afterCreate = function (conn, done) {
                        conn.on('notice', function (msg) {
                            pglogevent.emit('getPgLogs', msg);
                        });
                        done('', conn);
                    };
                }
            } catch (error) {
                console.log('error------> ' + error);
            }
        }

        var knexConn = new reqKnex({
            client: pClient,
            native: false,
            connection: pConn,
            searchPath: pSearchPath
            // , pool: pPool ? pPool : defaultPooling
            , pool: {
                "max": pPool ? pPool.max : defaultPooling.max,
                "min": pPool ? pPool.min : defaultPooling.min
            }
            , acquireConnectionTimeout: pPool && pPool.acquireTimeout ? pPool.acquireTimeout : defaultPooling.acquireTimeout
        });
        var knexConnForTrx = new reqKnex({
            client: pClient,
            native: false,
            connection: pConn,
            searchPath: pSearchPath
            // , pool: pPool ? pPool : defaultPoolingFortrx
            , pool: {
                "max": pPool ? pPool.max : defaultPoolingFortrx.max,
                "min": pPool ? pPool.min : defaultPoolingFortrx.min
            }, acquireConnectionTimeout: pPool && pPool.acquireTimeout ? pPool.acquireTimeout : defaultPoolingFortrx.acquireTimeout
        });

        reqInstanceHelper.PrintInfo(serviceName, 'Knex require done ', pLogInfo);
        checkConnection(pClient, knexConn, pLogInfo, function (result) {
            try {
                reqInstanceHelper.PrintInfo(serviceName, 'checkConnection callback going to called', pLogInfo);
                if (result == 'SUCCESS') {
                    return callback(null, knexConn, knexConnForTrx, pClient);
                } else {
                    return callback(result, null);
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231001', 'Error in checkConnection callback', error);
                return callback(error, null);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231002', 'Error in getKnexConnection function', error);
        return callback(error, null);
    }
}

// To destroy knex connection
function DestroyKnexConnection(pClient, callback) {
    try {
        if (pClient && pClient.destroy) {
            pClient.destroy(function (error, result) {
                return callback(error);
            });
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231003', 'Error in DestroyKnexConnection function', error);
        return callback(error);
    }
}

// This will return object with keys in uppercase
function _objKeyToUpperCase(pObj) {
    try {
        var objForReturn = new Object();
        for (var key in pObj) {
            var strUpperCaseKey = key.toUpperCase();
            objForReturn[strUpperCaseKey] = pObj[key];
        }
        return objForReturn;
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231004', 'Error in _objKeyToUpperCase function', error);
        return null;
    }
}

// This will return object with keys in lowercase
function _objKeyToLowerCase(pObj) {
    try {
        var objForReturn = new Object();
        for (var key in pObj) {
            var strLowerCaseKey = key.toLowerCase();
            objForReturn[strLowerCaseKey] = pObj[key];
        }
        return objForReturn;
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231005', 'Error in _objKeyToLowerCase function', error);
        return null;
    }
}


function callDisconnect(pCallback) {
    try {
        reqInstanceHelper.PrintInfo(serviceName, 'Disconnecting due to knex Error', objLogInfo);
        global.disconnecttran(function (res) {
            try {
                if (res) {
                    reqInstanceHelper.PrintInfo(serviceName, 'DB Disconnect Failed', objLogInfo);
                } else {
                    reqInstanceHelper.PrintInfo(serviceName, 'DB Disconnected', objLogInfo);
                    pCallback('SUCCESS');
                }
            } catch (error) {
                return pCallback('FAILURE');
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintInfo(serviceName, objLogInfo, 'Exception occured DB Disconnect Failed' + error);
    }
}

function _ChangeObjCase(pDBType, pObj) {
    try {
        if (pDBType.toLowerCase() == 'pg' || pDBType.toLowerCase() == 'mysql') {
            return _objKeyToLowerCase(pObj);
        } else if (pDBType.toLowerCase() == 'oracledb') {
            return _objKeyToUpperCase(pObj);
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231117', 'Error in _ChangeObjCase function', error);
    }
}

// To list the table with given condition
function List(pHeaders, pKnex, pTrx, pTableName, pCond, pLogInfo, pDBType, pCallback) {
    try {
        var arrColumns = '*';
        if (pLogInfo && pLogInfo.columnList && pLogInfo.columnList.length) {
            arrColumns = pLogInfo.columnList;
            if (pDBType.toLowerCase() == 'pg') {
                arrColumns = arrColumns.toString().toLowerCase().split(',');
            }
            else if (pDBType.toLowerCase() == 'oracledb') {
                arrColumns = arrColumns.toString().toUpperCase().split(',');
            }
        }
        var query = pKnex.select(arrColumns).from(_ChangeCase(pDBType, pTableName));
        if (pTrx) {
            query = query.transacting(pTrx);
        }
        var condCols = Object.keys(pCond);
        if (condCols.length) {
            var whereAdded = false;
            var whereInAdded = false;
            for (var i = 0; i < condCols.length; i++) {
                var colName = condCols[i];
                var dataType = typeof pCond[colName];
                if (i == 0) {
                    if (dataType == 'object') {
                        query.whereIn(_ChangeCase(pDBType, colName), pCond[colName]);
                        whereInAdded = true;
                    } else {
                        query.where(_ChangeCase(pDBType, colName), pCond[colName]);
                        whereAdded = true;
                    }
                } else {
                    if (dataType == 'object') {
                        if (whereInAdded) {
                            query.andWhereIn(_ChangeCase(pDBType, colName), pCond[colName]);
                        } else {
                            query.whereIn(_ChangeCase(pDBType, colName), pCond[colName]);
                            whereInAdded = true;
                        }
                    } else {
                        if (whereAdded) {
                            query.andWhere(_ChangeCase(pDBType, colName), pCond[colName]);
                        } else {
                            query.where(_ChangeCase(pDBType, colName), pCond[colName]);
                            whereAdded = true;
                        }
                    }
                }
            }
        }
        var bindings = query.toSQL().bindings;
        var strQuery = query.toSQL().sql;
        strQuery = strQuery + bindings;
        _PrintQuery(pLogInfo, 'Query :' + query);
        // _PrintQuery(pLogInfo, 'InputParams :' + JSON.stringify(bindings));
        var routingkey = pHeaders.routingkey;
        if (routingkey) {
            var arrKey = routingkey.split('~');
            //var clientId = arrKey[0].split('-')[1];
            // var appId = arrKey[1].split('-')[1];
            var uniquKey = 'META_CACHE~' + reqEncryptionInstance.EncryptPassword(strQuery);
            var gCacheProperties = false;
            var schema = pKnex.schemaName;
            if (schema == 'dep_cas' || (schema == 'clt_cas' && cltCacheTables.indexOf(pTableName.toLowerCase()) > -1 && bindings.indexOf('CACHE_PROPERTIES') <= -1)) {
                reqCacheRedisInstance.GetCacheProperties(pHeaders, pLogInfo, function (cacheProperties) {
                    try {
                        gCacheProperties = cacheProperties;
                        if (gCacheProperties && gCacheProperties.NEED_CACHE) {
                            var params = {
                                db: 'db0',
                                uniquKey: uniquKey
                            };
                            reqCacheRedisInstance.GetCacheFromRedis(pHeaders, params, pLogInfo, function (result) {
                                try {
                                    if (result) {
                                        return pCallback(JSON.parse(result));
                                    } else {
                                        doDBQuery();
                                    }
                                } catch (error) {
                                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231113', 'Error in GetCacheFromRedis callback', error);
                                }
                            });
                        } else {
                            doDBQuery();
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231115', 'Error in GetCacheProperties callback', error);
                    }
                });
            } else {
                doDBQuery();
            }
        } else {
            doDBQuery();
        }

        function doDBQuery() {
            try {
                // query.then(function CallbackSelectSuccess(pResult, pErr) {
                runQuery(query, pLogInfo, function CallbackSelectSuccess(pResult, pErr) {
                    try {

                        if (pLogInfo && pLogInfo.columnList) {
                            delete pLogInfo.columnList;
                        }
                        if (pResult) {
                            var result = arrKeyToLowerCase(pResult, pDBType);
                            _PrintQuery(pLogInfo, 'Returned Rows ' + pResult.length);
                            if (gCacheProperties && gCacheProperties.NEED_CACHE) {
                                var params = {
                                    db: 'db0',
                                    uniquKey: uniquKey,
                                    value: JSON.stringify(result),
                                    expirMin: gCacheProperties.CACHE_TIMEOUT_IN_MINS
                                };
                                reqCacheRedisInstance.AddCacheToRedis(pHeaders, params, pLogInfo, function (result) {
                                    try {
                                        reqInstanceHelper.PrintInfo(serviceName, result, pLogInfo);
                                    } catch (error) {
                                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231116', 'Error in AddCacheToRedis callback', error);
                                    }
                                });
                            }
                            return pCallback(result, pErr);
                        } else {
                            return pCallback(pResult, pErr);
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231006', 'Error in CallbackSelectSuccess function', error);
                        return pCallback(null, error);
                    }
                });
                // .catch(function (error) {
                //     reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-2310070', 'Error in List function', error.stack);
                //     if (!global.DisconnInProgress && checkknexerr(error)) {
                //         console.log('-------------destory called');
                //         if (!pLogInfo) {
                //             pLogInfo = {};
                //         }
                //         pLogInfo.RestartErrorObj = error;
                //         reqInstanceHelper.restartSvc(pLogInfo);
                //     } else {
                //         return pCallback(null, error);
                //     }
                // });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231118', 'Error in doDBQuery callback function', error);
            }
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231008', 'Error in List function', error);
        return pCallback(null, error);
    }
}


// To list the table with given condition
function ListWithoutCache(pHeaders, pKnex, pTrx, pTableName, pCond, pLogInfo, pDBType, pCallback) {
    try {
        var arrColumns = '*';
        if (pLogInfo && pLogInfo.columnList && pLogInfo.columnList.length) {
            arrColumns = pLogInfo.columnList;
            if (pDBType.toLowerCase() == 'pg') {
                arrColumns = arrColumns.toString().toLowerCase().split(',');
            }
            else if (pDBType.toLowerCase() == 'oracledb') {
                arrColumns = arrColumns.toString().toUpperCase().split(',');
            }
        }
        var query = pKnex.select(arrColumns).from(_ChangeCase(pDBType, pTableName));
        if (pTrx) {
            query = query.transacting(pTrx);
        }
        var condCols = Object.keys(pCond);
        if (condCols.length) {
            var whereAdded = false;
            var whereInAdded = false;
            for (var i = 0; i < condCols.length; i++) {
                var colName = condCols[i];
                var dataType = typeof pCond[colName];
                if (i == 0) {
                    if (dataType == 'object') {
                        query.whereIn(_ChangeCase(pDBType, colName), pCond[colName]);
                        whereInAdded = true;
                    } else {
                        query.where(_ChangeCase(pDBType, colName), pCond[colName]);
                        whereAdded = true;
                    }
                } else {
                    if (dataType == 'object') {
                        if (whereInAdded) {
                            query.andWhereIn(_ChangeCase(pDBType, colName), pCond[colName]);
                        } else {
                            query.whereIn(_ChangeCase(pDBType, colName), pCond[colName]);
                            whereInAdded = true;
                        }
                    } else {
                        if (whereAdded) {
                            query.andWhere(_ChangeCase(pDBType, colName), pCond[colName]);
                        } else {
                            query.where(_ChangeCase(pDBType, colName), pCond[colName]);
                            whereAdded = true;
                        }
                    }
                }
            }
        }
        var bindings = query.toSQL().bindings;
        var strQuery = query.toSQL().sql;
        strQuery = strQuery + bindings;
        _PrintQuery(pLogInfo, 'Query :' + query.toSQL().sql.replaceAll(process.env.PCIDSS_KEY, '**********'));
        // _PrintQuery(pLogInfo, 'InputParams :' + JSON.stringify(bindings));
        var routingkey = pHeaders.routingkey;
        doDBQuery();

        function doDBQuery() {
            try {
                // query.then(function CallbackSelectSuccess(pResult, pErr) {
                runQuery(query, pLogInfo, function CallbackSelectSuccess(pResult, pErr) {
                    try {
                        if (pLogInfo && pLogInfo.columnList) {
                            delete pLogInfo.columnList;
                        }
                        var result = arrKeyToLowerCase(pResult, pDBType);
                        _PrintQuery(pLogInfo, 'Returned Rows ' + pResult.length);
                        return pCallback(result, pErr);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231006', 'Error in CallbackSelectSuccess function', error);
                        return pCallback(null, error);
                    }
                });
                // .catch(function (error) {
                //     reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231007', 'Error in List function', error.stack);
                //     if (!global.DisconnInProgress && checkErrType(error)) {
                //         console.log('-------------destory called');
                //         if (!pLogInfo) {
                //             pLogInfo = {};
                //         }
                //         pLogInfo.RestartErrorObj = error;
                //         reqInstanceHelper.restartSvc(pLogInfo);
                //     } else {
                //         return pCallback(null, error);
                //     }
                // });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231118', 'Error in doDBQuery callback function', error);
            }
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231008', 'Error in List function', error);
        return pCallback(null, error);
    }
}


function checkErrType(errobj) {
    var nextAction = 'RETRY_QUERY';
    try {
        reqInstanceHelper.PrintInfo(serviceName, 'Checking error type ', objLogInfo);
        errobj = errobj.message;
        if (errobj.indexOf('The pool is probably full') > -1) {

        } else if (errobj.indexOf('Timeout acquiring a connection') > -1) {

        } else if (errobj.indexOf('pool is draining and cannot accept work') > -1) {

        } else if (errobj.indexOf('Unable to acquire a connection') > -1) {

        } else if (errobj.indexOf('not connected to ORACLE') > -1) {

        } else if (errobj.indexOf('TimeoutError: operation timed out Error') > -1) {

        } else if (errobj.indexOf('TNS:listener could not find available handler with matching protocol') > -1) {

        } else if (errobj.indexOf('end-of-file on communication channel') > -1) {
        }
        else {
            nextAction = 'RESET_CONN';
        }
        reqInstanceHelper.PrintInfo(serviceName, 'After error action taking | ' + nextAction, objLogInfo);
        return nextAction;
    } catch (error) {

    }
}

function _ChangeCase(pDBType, pString) {
    try {
        if (pDBType.toLowerCase() == 'pg' || pDBType.toLowerCase() == 'mysql') {
            return pString.toLowerCase();
        } else if (pDBType.toLowerCase() == 'oracledb') {
            return pString.toUpperCase();
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231119', 'Error in _ChangeCase function', error);
    }
}


// for insert prepare new audit column and its values from objLogInfo
function prepareInsertAuditColumn(pRows, pLogInfo) {
    try {
        var inserarr = Object.keys(pRows);
        inserarr = inserarr.map(function (x) { return x.toUpperCase(); });
        for (var colIdx = 0; colIdx < InsertAuditColumns.length; colIdx++) {
            delete pRows[InsertAuditColumns[colIdx].toLowerCase()];
            delete pRows[InsertAuditColumns[colIdx].toUpperCase()];
            if (InsertAuditColumns[colIdx].toUpperCase() == "CREATED_BY_NAME") {
                pRows[InsertAuditColumns[colIdx]] = pLogInfo.LOGIN_NAME;
            } else if (InsertAuditColumns[colIdx].toUpperCase() == "CREATED_CLIENTIP") {
                pRows[InsertAuditColumns[colIdx]] = pLogInfo.CLIENTIP;
            } else if (InsertAuditColumns[colIdx].toUpperCase() == "CREATED_BY") {
                pRows[InsertAuditColumns[colIdx]] = pLogInfo.USER_ID;
            } else if (InsertAuditColumns[colIdx].toUpperCase() == "CREATED_TZ") {
                pRows[InsertAuditColumns[colIdx]] = pLogInfo.CLIENTTZ;
            } else if (InsertAuditColumns[colIdx].toUpperCase() == "CREATED_TZ_OFFSET") {
                pRows[InsertAuditColumns[colIdx]] = pLogInfo.CLIENTTZ_OFFSET;
            } else if (InsertAuditColumns[colIdx].toUpperCase() == "CREATED_BY_SESSIONID") {
                pRows[InsertAuditColumns[colIdx]] = pLogInfo.SESSION_ID;
            } else if (InsertAuditColumns[colIdx].toUpperCase() == "ROUTINGKEY") {
                pRows[InsertAuditColumns[colIdx]] = pLogInfo.headers.routingkey;
            } else if (InsertAuditColumns[colIdx].toUpperCase() == "CREATED_DATE") {
                pRows[InsertAuditColumns[colIdx]] = reqDateFormatter.GetTenantCurrentDateTime(pLogInfo.headers, pLogInfo);
            } else if (InsertAuditColumns[colIdx].toUpperCase() == "APP_ID") {
                pRows[InsertAuditColumns[colIdx]] = pLogInfo.APP_ID;
            } else if (InsertAuditColumns[colIdx].toUpperCase() == "TENANT_ID") {
                pRows[InsertAuditColumns[colIdx]] = pLogInfo.TENANT_ID;
            } else if (InsertAuditColumns[colIdx].toUpperCase() == "CREATED_DATE_UTC") {
                pRows[InsertAuditColumns[colIdx]] = reqDateFormatter.GetCurrentDateInUTC(pLogInfo.headers, pLogInfo);
            }
        }
    } catch (error) {

    }
}

// for insert prepare new audit column and its values from objLogInfo
function prepareUpdateAuditColumn(pDBType, pRows, pLogInfo) {
    try {
        // pRows = _ChangeObjCase(pDBType, pRows);
        var updatearr = Object.keys(_ChangeObjCase(pDBType, pRows));

        for (var colIdx = 0; colIdx < ModifyAuditColumns.length; colIdx++) {
            //console.log(`Audit column ${ModifyAuditColumns[colIdx]} not available. Get it from loginfo `);
            delete pRows[ModifyAuditColumns[colIdx].toLowerCase()];
            delete pRows[ModifyAuditColumns[colIdx].toUpperCase()];
            if (ModifyAuditColumns[colIdx] == "MODIFIED_BY_NAME") {
                pRows[ModifyAuditColumns[colIdx]] = pLogInfo.LOGIN_NAME;
            } else if (ModifyAuditColumns[colIdx] == "MODIFIED_CLIENTIP") {
                pRows[ModifyAuditColumns[colIdx]] = pLogInfo.CLIENTIP;
            } else if (ModifyAuditColumns[colIdx] == "MODIFIED_BY") {
                pRows[ModifyAuditColumns[colIdx]] = pLogInfo.USER_ID;
            } else if (ModifyAuditColumns[colIdx] == "MODIFIED_TZ") {
                pRows[ModifyAuditColumns[colIdx]] = pLogInfo.CLIENTTZ;
            } else if (ModifyAuditColumns[colIdx] == "MODIFIED_TZ_OFFSET") {
                pRows[ModifyAuditColumns[colIdx]] = pLogInfo.CLIENTTZ_OFFSET;
            } else if (ModifyAuditColumns[colIdx] == "MODIFIED_BY_SESSIONID") {
                pRows[ModifyAuditColumns[colIdx]] = pLogInfo.SESSION_ID;
            } else if (ModifyAuditColumns[colIdx] == "MODIFIED_DATE") {
                pRows[ModifyAuditColumns[colIdx]] = reqDateFormatter.GetTenantCurrentDateTime(pLogInfo.headers, pLogInfo);
            } else if (ModifyAuditColumns[colIdx].toUpperCase() == "MODIFIED_DATE_UTC") {
                pRows[ModifyAuditColumns[colIdx]] = reqDateFormatter.GetCurrentDateInUTC(pLogInfo.headers, pLogInfo);
            }
        }
    } catch (error) {
        console.log(error);
    }
}


// To insert a data to given table with or without scope
function Insert(pKnex, pTrx, pTableName, pRows, pLogInfo, pDBType, pCallback) {
    try {
        var arrForInsert = [];
        for (var i = 0; i < pRows.length; i++) {
            arrForInsert.push(_ChangeObjCase(pDBType, pRows[i]));
        }
        var query = '';
        query = pKnex(_ChangeCase(pDBType, pTableName)).insert(arrForInsert).returning('*');
        if (pTrx) {
            query.transacting(pTrx);
        }
        _PrintQuery(pLogInfo, 'Query :' + query.toSQL().sql.replaceAll(process.env.PCIDSS_KEY, '**********'));
        _PrintQuery(pLogInfo, 'InputParams :' + JSON.stringify(query.toSQL().bindings));
        // query.then(function (pResult, pErr) {
        runQuery(query, pLogInfo, function (pResult, pErr) {
            try {
                if (!pErr) {
                    _PrintQuery(pLogInfo, 'Inserted Rows ' + pResult.length);
                }
                return pCallback(arrKeyToLowerCase(pResult, pDBType), pErr);
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231009', 'Error in Insert function', error);
                return pCallback(null, error);
            }
        });
        // .catch(function (error) {
        //     try {
        //         reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231010', 'Error in Insert function', error);
        //         if (error.code == '23505') {
        //             var errStack = error.stack;
        //             var errMsg = '';
        //             if (errStack) {
        //                 errMsg = errStack.split('-')[1];
        //             }
        //             return pCallback(null, 'Save not done - ' + errMsg);
        //         } else {
        //             return pCallback(null, error);
        //         }
        //     } catch (error) {
        //         reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231120', 'Error in Insert function', error);
        //     }
        // });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231011', 'Error in Insert function', error);
        return pCallback(null, error);
    }
}


// To insert a data to given table with or without scope with audit values
function InsertwithAudit(pKnex, pTrx, pTableName, pRows, pLogInfo, pDBType, pCallback) {
    try {
        var arrForInsert = [];
        for (var i = 0; i < pRows.length; i++) {
            prepareInsertAuditColumn(pRows[i], pLogInfo);
            arrForInsert.push(_ChangeObjCase(pDBType, pRows[i]));
        }
        var query = '';
        query = pKnex(_ChangeCase(pDBType, pTableName)).insert(arrForInsert).returning('*');
        if (pTrx) {
            query.transacting(pTrx);
        }
        _PrintQuery(pLogInfo, 'Query :' + query.toSQL().sql.replaceAll(process.env.PCIDSS_KEY, '**********'));
        //_PrintQuery(pLogInfo, 'InputParams :' + JSON.stringify(query.toSQL().bindings));
        // query.then(function (pResult, pErr) {
        runQuery(query, pLogInfo, function (pResult, pErr) {
            try {
                if (!pErr) {
                    _PrintQuery(pLogInfo, 'Inserted Rows ' + pResult.length);
                }
                return pCallback(arrKeyToLowerCase(pResult, pDBType), pErr);
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231009', 'Error in Insert function', error);
                return pCallback(null, error);
            }
        });
        // .catch(function (error) {
        //     try {
        //         reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231010', 'Error in Insert function', error);
        //         if (error.code == '23505') {
        //             var errStack = error.stack;
        //             var errMsg = '';
        //             if (errStack) {
        //                 errMsg = errStack.split('-')[1];
        //             }
        //             return pCallback(null, 'Save not done - ' + errMsg);
        //         } else {
        //             return pCallback(null, error);
        //         }
        //     } catch (error) {
        //         reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231120', 'Error in Insert function', error);
        //     }
        // });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231011', 'Error in Insert function', error);
        return pCallback(null, error);
    }
}

// To insert bulk data to given table with or without scope
function InsertBulk(pKnex, pTrx, pTableName, pRows, pLogInfo, pDBType, pChunckSize, pCallback) {
    try {
        var chunkSize = pChunckSize ? pChunckSize : 200;
        var arrForInsert = [];
        for (var i = 0; i < pRows.length; i++) {
            arrForInsert.push(_ChangeObjCase(pDBType, pRows[i]));
        }
        var query = '';
        query = pKnex.batchInsert(_ChangeCase(pDBType, pTableName), arrForInsert, chunkSize).returning('*');
        if (pTrx) {
            query.transacting(pTrx);
        }
        //_PrintQuery(pLogInfo, 'Query :' + query.toSQL().sql);
        //_PrintQuery(pLogInfo, 'InputParams :' + JSON.stringify(query.toSQL().bindings));
        // query.then(function (pResult, pErr) {
        runQuery(query, pLogInfo, function (pResult, pErr) {
            try {
                if (pResult) {
                    _PrintQuery(pLogInfo, 'Inserted Rows ' + pResult.length);
                }
                return pCallback(arrKeyToLowerCase(pResult, pDBType), pErr);
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231009', 'Error in Insert function', error);
                return pCallback(null, error);
            }
        });
        // .catch(function (error) {
        //     try {
        //         reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231010', 'Error in Insert function', error);
        //         if (error.code == '23505') {
        //             return pCallback(null, 'Duplicate values found, Save not done.');
        //         } else {
        //             return pCallback(null, error);
        //         }
        //     } catch (error) {
        //         reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231121', 'Error in InsertBulk function', error);
        //     }
        // });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231011', 'Error in Insert function', error);
        return pCallback(null, error);
    }
}


// To insert bulk data to given table with or without scope
function InsertBulkWithAudit(pKnex, pTrx, pTableName, pRows, pLogInfo, pDBType, pChunckSize, pCallback) {
    try {
        var chunkSize = pChunckSize ? pChunckSize : 200;
        var arrForInsert = [];
        for (var i = 0; i < pRows.length; i++) {
            prepareInsertAuditColumn(pRows[i], pLogInfo);
            arrForInsert.push(_ChangeObjCase(pDBType, pRows[i]));
        }
        var query = '';
        query = pKnex.batchInsert(_ChangeCase(pDBType, pTableName), arrForInsert, chunkSize).returning('*');
        if (pTrx) {
            query.transacting(pTrx);
        }
        //_PrintQuery(pLogInfo, 'Query :' + query.toSQL().sql);
        //_PrintQuery(pLogInfo, 'InputParams :' + JSON.stringify(query.toSQL().bindings));
        // query.then(function (pResult, pErr) {
        runQuery(query, pLogInfo, function (pResult, pErr) {
            try {
                if (pErr) {
                    return pCallback(null, pErr);
                } else {
                    _PrintQuery(pLogInfo, 'Inserted Rows ' + pResult.length);
                    return pCallback(arrKeyToLowerCase(pResult, pDBType), pErr);
                }

            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231009', 'Error in Insert function', error);
                return pCallback(null, error);
            }
        });
        // .catch(function (error) {
        //     try {
        //         reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231010', 'Error in Insert function', error);
        //         if (error.code == '23505') {
        //             return pCallback(null, 'Duplicate values found, Save not done.');
        //         } else {
        //             return pCallback(null, error);
        //         }
        //     } catch (error) {
        //         reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231121', 'Error in InsertBulk function', error);
        //     }
        // });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231011', 'Error in Insert function', error);
        return pCallback(null, error);
    }
}

// To perform update on given table with or without scope
function Update(pKnex, pTrx, pTableName, pRows, pCond, pLogInfo, pDBType, pCallback) {
    try {
        var query = '';
        if (pTableName) {
            query = pKnex(_ChangeCase(pDBType, pTableName)).update(_ChangeObjCase(pDBType, pRows));
            // if (pCond != '') {
            //     query.where(_objKeyToLowerCase(pCond));
            // }
            if (pCond) {
                var condCols = Object.keys(pCond);
                if (condCols.length) {
                    var whereAdded = false;
                    var whereInAdded = false;
                    for (var i = 0; i < condCols.length; i++) {
                        var colName = condCols[i];
                        var dataType = typeof pCond[colName];
                        if (i == 0) {
                            if (dataType == 'object') {
                                query.whereIn(_ChangeCase(pDBType, colName), pCond[colName]);
                                whereInAdded = true;
                            } else {
                                query.where(_ChangeCase(pDBType, colName), pCond[colName]);
                                whereAdded = true;
                            }
                        } else {
                            if (dataType == 'object') {
                                if (whereInAdded) {
                                    query.andWhereIn(_ChangeCase(pDBType, colName), pCond[colName]);
                                } else {
                                    query.whereIn(_ChangeCase(pDBType, colName), pCond[colName]);
                                    whereInAdded = true;
                                }
                            } else {
                                if (whereAdded) {
                                    query.andWhere(_ChangeCase(pDBType, colName), pCond[colName]);
                                } else {
                                    query.where(_ChangeCase(pDBType, colName), pCond[colName]);
                                    whereAdded = true;
                                }
                            }
                        }
                    }
                }
            }
            if (pTrx) {
                query.transacting(pTrx);
            }
            if (query) {
                _PrintQuery(pLogInfo, 'Query :' + query.toSQL().sql.replaceAll(process.env.PCIDSS_KEY, '**********'));
                // _PrintQuery(pLogInfo, 'InputParams :' + JSON.stringify(query.toSQL().bindings));
                // query.then(function (pResult, pErr) {
                runQuery(query, pLogInfo, function (pResult, pErr) {
                    try {
                        _PrintQuery(pLogInfo, 'Updated Rows ' + pResult);
                        return pCallback(arrKeyToLowerCase(pResult, pDBType), pErr);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231012', 'Error in Update function', error);
                        return pCallback(null, error);
                    }
                });
                // .catch(function (error) {
                //     reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231013', 'Error in Update function', error);
                //     return pCallback(null, error);
                // });
            }
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231014', 'Error in Update function', error);
        return pCallback(null, error);
    }
}


// To perform update on given table with or without scope
function UpdateWithAudit(pKnex, pTrx, pTableName, pRows, pCond, pLogInfo, pDBType, pCallback) {
    try {
        var query = '';
        if (pTableName) {

            prepareUpdateAuditColumn(pDBType, pRows, pLogInfo);
            query = pKnex(_ChangeCase(pDBType, pTableName)).update(_ChangeObjCase(pDBType, pRows));
            // if (pCond != '') {
            //     query.where(_objKeyToLowerCase(pCond));
            // }
            if (pCond) {
                var condCols = Object.keys(pCond);
                if (condCols.length) {
                    var whereAdded = false;
                    var whereInAdded = false;
                    for (var i = 0; i < condCols.length; i++) {
                        var colName = condCols[i];
                        var dataType = typeof pCond[colName];
                        if (i == 0) {
                            if (dataType == 'object') {
                                query.whereIn(_ChangeCase(pDBType, colName), pCond[colName]);
                                whereInAdded = true;
                            } else {
                                query.where(_ChangeCase(pDBType, colName), pCond[colName]);
                                whereAdded = true;
                            }
                        } else {
                            if (dataType == 'object') {
                                if (whereInAdded) {
                                    query.andWhereIn(_ChangeCase(pDBType, colName), pCond[colName]);
                                } else {
                                    query.whereIn(_ChangeCase(pDBType, colName), pCond[colName]);
                                    whereInAdded = true;
                                }
                            } else {
                                if (whereAdded) {
                                    query.andWhere(_ChangeCase(pDBType, colName), pCond[colName]);
                                } else {
                                    query.where(_ChangeCase(pDBType, colName), pCond[colName]);
                                    whereAdded = true;
                                }
                            }
                        }
                    }
                }
            }
            if (pTrx) {
                query.transacting(pTrx);
            }
            if (query) {
                _PrintQuery(pLogInfo, 'Query :' + query.toSQL().sql.replaceAll(process.env.PCIDSS_KEY, '**********'));
                // _PrintQuery(pLogInfo, 'InputParams :' + JSON.stringify(query.toSQL().bindings));
                // query.then(function (pResult, pErr) {
                runQuery(query, pLogInfo, function (pResult, pErr) {
                    try {
                        _PrintQuery(pLogInfo, 'Updated Rows ' + pResult);
                        return pCallback(arrKeyToLowerCase(pResult, pDBType), pErr);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231012', 'Error in Update function', error);
                        return pCallback(null, error);
                    }
                });
                // .catch(function (error) {
                //     reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231013', 'Error in Update function', error);
                //     return pCallback(null, error);
                // });
            }
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231014', 'Error in Update function', error);
        return pCallback(null, error);
    }
}

// To delete the given table data for particular condition
function Delete(pKnex, pTrx, pTableName, pCond, pLogInfo, pDBType, pCallback) {
    try {
        var query = '';
        if (pTableName) {
            query = pKnex(_ChangeCase(pDBType, pTableName));
            var condCols = Object.keys(pCond);
            if (condCols.length) {
                var whereAdded = false;
                var whereInAdded = false;
                for (var i = 0; i < condCols.length; i++) {
                    var colName = condCols[i];
                    var dataType = typeof pCond[colName];
                    if (i == 0) {
                        if (dataType == 'object') {
                            query.whereIn(_ChangeCase(pDBType, colName), pCond[colName]);
                            whereInAdded = true;
                        } else {
                            query.where(_ChangeCase(pDBType, colName), pCond[colName]);
                            whereAdded = true;
                        }
                    } else {
                        if (dataType == 'object') {
                            if (whereInAdded) {
                                query.andWhereIn(_ChangeCase(pDBType, colName), pCond[colName]);
                            } else {
                                query.whereIn(_ChangeCase(pDBType, colName), pCond[colName]);
                                whereInAdded = true;
                            }
                        } else {
                            if (whereAdded) {
                                query.andWhere(_ChangeCase(pDBType, colName), pCond[colName]);
                            } else {
                                query.where(_ChangeCase(pDBType, colName), pCond[colName]);
                                whereAdded = true;
                            }
                        }
                    }
                }
            }

            if (pTrx) {
                query.transacting(pTrx);
            }
            if (query) {
                _PrintQuery(pLogInfo, 'Query :' + query.toSQL().sql.replaceAll(process.env.PCIDSS_KEY, '**********'));
                // _PrintQuery(pLogInfo, 'InputParams :' + JSON.stringify(query.toSQL().bindings));
                // query.del().then(function (pResult, pErr) {
                var delQuery = query.del();
                runQuery(delQuery, pLogInfo, function (pResult, pErr) {
                    try {
                        _PrintQuery(pLogInfo, 'Deleted Rows ' + pResult);
                        return pCallback('SUCCESS', pErr);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231015', 'Error in Delete function', error);
                        return pCallback('FAILURE', error);
                    }
                });
                // .catch(function (error) {
                //     reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231016', 'Error in Delete function', error);
                //     return pCallback('FAILURE', error);
                // });
            }
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231017', 'Error in Delete function', error);
        return pCallback('FAILURE', error);
    }
}

// Execute the raw SQL query 
async function ExecuteSQLQuery(pTranDB, pTrx, pQuery, pLogInfo, pDBType, pCallback) {
    try {
        if (pDBType == 'oracledb') {
            // pTranDB.client.driver.maxRows = 10000;
            //for number data type floting point issue (so get the value as string)
            // pLogInfo.fetchAsString=true - This param is used to get number data result as string Ex: 32.45 necomes '32.45'
            pTranDB.client.driver.fetchAsString = [];
            if (pLogInfo && pLogInfo.fetchAsString) {
                pTranDB.client.driver.fetchAsString = [pTranDB.client.driver.NUMBER];
                pTranDB.client.fetchAsString = [pTranDB.client.driver.NUMBER];
                // pTranDB.client.fetchAsString = [pTranDB.client.driver.DATE];

            }
        }
        // if (pQuery.indexOf('<arc_res_db>') > -1 || pQuery.indexOf('<ARC_RES_DB>') > -1 || pQuery.indexOf('<arc_tran_db>') > -1 || pQuery.indexOf('<ARC_TRAN_DB>') > -1 || pQuery.indexOf('<clt_cas>') > -1 || pQuery.indexOf('<dep_cas>') > -1 || pQuery.indexOf('<res_cas>') > -1 || pQuery.indexOf('<CLT_CAS>') > -1 || pQuery.indexOf('<DEP_CAS>') > -1 || pQuery.indexOf('<RES_CAS>') > -1 || pQuery.indexOf('<TRAN_DB>') > -1 || pQuery.indexOf('<tran_db>') > -1) {
        //var pkey = 'ORACLE' + '~' + pLogInfo.ROUTING_KEY;
        var schemaDetails = await GetSchemaDetail(pDBType, pLogInfo);
        if (pLogInfo && pLogInfo.DB_MODE && pLogInfo.DB_MODE == 'ARCHIVAL') {
            pQuery = pQuery.replaceAll('<tran_db>', '<arc_tran_db>')
            pQuery = pQuery.replaceAll('<TRAN_DB>', '<ARC_TRAN_DB>')
        }
        for (var schema in schemaDetails) {
            if (pDBType.toLowerCase() == 'oracledb') {
                pQuery = pQuery.replace(new RegExp(`<${schema.toUpperCase()}>`, 'g'), schemaDetails[schema]);
                pQuery = pQuery.replace(new RegExp(`<${schema.toLowerCase()}>`, 'g'), schemaDetails[schema]);
            } else {
                pQuery = pQuery.replace(new RegExp(`<${schema.toUpperCase()}>`, 'g'), `"${schemaDetails[schema]}"`);
                pQuery = pQuery.replace(new RegExp(`<${schema.toLowerCase()}>`, 'g'), `"${schemaDetails[schema]}"`);

            }
        }
        pQuery = pQuery.replaceAll('$PCIDSS_KEY', `'${process.env.PCIDSS_KEY}'`)

        // pQuery = pQuery.replace(new RegExp(`<tran_db>.`, 'g'), '');
        // pQuery = pQuery.replace(new RegExp(`<TRAN_DB>.`, 'g'), '');
        // }

        var query = pTranDB.raw(pQuery);
        try {
            _PrintQuery(pLogInfo, 'Knex used pool count - ' + pTranDB.client.pool.numUsed());
            _PrintQuery(pLogInfo, 'Knex Free pool count - ' + pTranDB.client.pool.numFree());
            _PrintQuery(pLogInfo, 'Knex PendingAcquires pool count - ' + pTranDB.client.pool.numPendingAcquires());
            _PrintQuery(pLogInfo, 'Knex PendingCreates pool count - ' + pTranDB.client.pool.numPendingCreates());
        } catch (error) {
            _PrintQuery(pLogInfo, error);
        }
        _PrintQuery(pLogInfo, 'Query :' + query.toSQL().sql.replaceAll(process.env.PCIDSS_KEY, '**********'));
        if (pTrx) {
            query = query.transacting(pTrx);
            _PrintQuery(pLogInfo, 'Transaction scope is - TRUE');
        } else {
            _PrintQuery(pLogInfo, 'Transaction scope is - FALSE');
        }

        if (pDBType == 'pg') {
            // event listner for to get pg procedure logs
            pglogevent.on('getPgLogs', collectpglogs);
            reqInstanceHelper.PrintInfo(serviceName, 'pg log event created to get pg function(raise notice/info) logs', pLogInfo);
            function collectpglogs(msg) {
                // collect pg logs
                _PrintQuery(pLogInfo, msg);
            }
        }
        // query.then(function (res, error) {
        runQuery(query, pLogInfo, function (res, error) {
            try {
                if (pDBType && pDBType == 'pg' && pglogevent) {
                    pglogevent.off('getPgLogs', collectpglogs);
                    reqInstanceHelper.PrintInfo(serviceName, 'pg log event removed', pLogInfo);
                }
                if (error) {
                    reqInstanceHelper.PrintInfo(serviceName, 'ERR-KNEX-231018 Error in ExecuteSQLQuery function ' + error, pLogInfo);
                    return pCallback(null, error);
                }
                //console.log('Error ' + error);
                else {
                    if (pLogInfo && pLogInfo.fetchAsString) {
                        delete pLogInfo.fetchAsString;
                    }
                    var strLength = '0';
                    if (pDBType.toLowerCase() == 'pg' || pDBType.toLowerCase() == 'mysql') {
                        strLength = res.rows ? res.rows.length : 0;
                        res.rows = arrKeyToLowerCase(res.rows, pDBType);
                    } else if (pDBType.toLowerCase() == 'oracledb') {
                        var result = {};
                        result.rows = arrKeyToLowerCase(res, pDBType);
                        if (result.rows.length > 0) {
                            result.fields = getfields(res);
                        } else {
                            result.fields = [];
                        }
                        strLength = result.rows.length;
                        _PrintQuery(pLogInfo, 'Returned Rows ' + strLength);
                        return pCallback(result, error);
                    } else {
                        res.rows = [];
                        res.fields = [];
                    }
                    _PrintQuery(pLogInfo, 'Returned Rows ' + strLength);
                    return pCallback(res, error);
                }
                //return res;
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231019', 'Error in ExecuteSQLQuery function', error);
                return pCallback(null, error);
            }
        });


        // .catch(function (error) {
        //     reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231020', 'Error in ExecuteSQLQuery function', error.stack);
        //     if (!global.DisconnInProgress && checkknexerr(error)) {
        //         if (!pLogInfo) {
        //             pLogInfo = {};
        //         }
        //         pLogInfo.RestartErrorObj = error;
        //         reqInstanceHelper.restartSvc(pLogInfo);
        //     } else {
        //         return pCallback(null, error);
        //     }
        // });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231021', 'Error in ExecuteSQLQuery function', error);
        return pCallback(null, error);
    }
}



async function ExecuteQueryWithPagingCount(pDBType, pTranDB, pTrx, pQuery, pPageNo, pPageSize, pLogInfo, pCallback) {
    try {
        reqInstanceHelper.PrintInfo(serviceName, "Inside ExecuteQueryWithPagingCount", null);
        var pQueryCount = ' select count(*) as count from (' + pQuery + ')';
        if (pDBType.toLowerCase() != 'oracledb') {
            pQueryCount = pQueryCount + 'as queryCount';
        }
        if (pDBType.toLowerCase() == 'oracledb') {
            pTranDB.client.driver.fetchAsString = [];
            if (pLogInfo && pLogInfo.fetchAsString) {
                pTranDB.client.driver.fetchAsString = [pTranDB.client.driver.NUMBER];
                pTranDB.client.fetchAsString = [pTranDB.client.driver.NUMBER];
                // pTranDB.client.fetchAsString = [pTranDB.client.driver.DATE];
            }
        }

        // if (pQuery.indexOf('<clt_cas>') > -1 || pQuery.indexOf('<dep_cas>') > -1 || pQuery.indexOf('<res_cas>') > -1 || pQuery.indexOf('<CLT_CAS>') > -1 || pQuery.indexOf('<DEP_CAS>') > -1 || pQuery.indexOf('<RES_CAS>') > -1 || pQuery.indexOf('<TRAN_DB>') > -1 || pQuery.indexOf('<tran_db>') > -1) {
        //var pkey = 'ORACLE' + '~' + pLogInfo.ROUTING_KEY;
        var schemaDetails = await GetSchemaDetail(pDBType, pLogInfo);

        if (pLogInfo && pLogInfo.DB_MODE && pLogInfo.DB_MODE == 'ARCHIVAL') {
            pQuery = pQuery.replaceAll('<tran_db>', '<arc_tran_db>')
            pQuery = pQuery.replaceAll('<TRAN_DB>', '<ARC_TRAN_DB>')
            pQueryCount = pQueryCount.replaceAll('<tran_db>', '<arc_tran_db>')
            pQueryCount = pQueryCount.replaceAll('<TRAN_DB>', '<ARC_TRAN_DB>')
        }
        for (var schema in schemaDetails) {
            if (pDBType.toLowerCase() == 'oracledb') {
                pQuery = pQuery.replace(new RegExp(`<${schema.toUpperCase()}>`, 'g'), schemaDetails[schema]);
                pQuery = pQuery.replace(new RegExp(`<${schema.toLowerCase()}>`, 'g'), schemaDetails[schema]);
                pQueryCount = pQueryCount.replace(new RegExp(`<${schema.toUpperCase()}>`, 'g'), schemaDetails[schema]);
                pQueryCount = pQueryCount.replace(new RegExp(`<${schema.toLowerCase()}>`, 'g'), schemaDetails[schema]);
            } else {
                pQuery = pQuery.replace(new RegExp(`<${schema.toUpperCase()}>`, 'g'), `"${schemaDetails[schema]}"`);
                pQuery = pQuery.replace(new RegExp(`<${schema.toLowerCase()}>`, 'g'), `"${schemaDetails[schema]}"`);
                pQueryCount = pQueryCount.replace(new RegExp(`<${schema.toUpperCase()}>`, 'g'), `"${schemaDetails[schema]}"`);
                pQueryCount = pQueryCount.replace(new RegExp(`<${schema.toLowerCase()}>`, 'g'), `"${schemaDetails[schema]}"`);
            }
        }


        pQuery = pQuery.replaceAll('$PCIDSS_KEY', `'${process.env.PCIDSS_KEY}'`);
        pQueryCount = pQueryCount.replaceAll('$PCIDSS_KEY', `'${process.env.PCIDSS_KEY}'`);

        // pQuery = pQuery.replace(new RegExp(`<tran_db>.`, 'g'), '');
        // pQuery = pQuery.replace(new RegExp(`<TRAN_DB>.`, 'g'), '');
        // pQueryCount = pQueryCount.replace(new RegExp(`<tran_db>.`, 'g'), '');
        // pQueryCount = pQueryCount.replace(new RegExp(`<TRAN_DB>.`, 'g'), '');
        // }

        reqAsync.parallel({
            queryone: function (parCb) {
                try {
                    var intOffSet = (pPageNo - 1) * pPageSize;
                    var query = _wrapRawQuery(pTranDB, pQuery, pDBType).limit(pPageSize).offset(intOffSet);
                    _PrintQuery(pLogInfo, 'Query :' + query.toSQL().sql.replaceAll(process.env.PCIDSS_KEY, '**********'));
                    _PrintQuery(pLogInfo, 'InputParams :' + JSON.stringify(query.toSQL().bindings));

                    if (pTrx)
                        query = query.transacting(pTrx);

                    query.asCallback(function (err, results) {
                        try {
                            parCb(err, results);
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231022', 'Error in ExecuteQueryWithPagingCount function', error);
                            parCb(error);
                        }
                    });
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231024', 'Error in ExecuteQueryWithPagingCount function', error);
                    parCb(error);
                }
            },
            querytwo: function (parCb) {
                try {
                    var query = _wrapRawQuery(pTranDB, pQueryCount, pDBType);
                    if (pTrx)
                        query = query.transacting(pTrx);
                    query.asCallback(function (err, results) {
                        try {
                            parCb(err, results);
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231025', 'Error in ExecuteQueryWithPagingCount function', error);
                            parCb(error);
                        }
                    });
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231027', 'Error in ExecuteQueryWithPagingCount function', error);
                    parCb(error);
                }
            },
        },
            function (error, results) {
                try {
                    if (pLogInfo && pLogInfo.fetchAsString) {
                        delete pLogInfo.fetchAsString;
                    }
                    if (error) {
                        //console.log('Error in query execution - ' + error);
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231028', 'Error in ExecuteQueryWithPagingCount function', error);
                    }
                    //Results are all ready, containing the results of two different queries
                    // console.log('Results for queryone: ' + JSON.stringify(results.queryone));
                    //console.log('Returned Rows : ' + JSON.stringify(results.querytwo));
                    reqInstanceHelper.PrintInfo(serviceName, 'Returned Rows : ' + JSON.stringify(results.querytwo), pLogInfo);
                    return pCallback(arrKeyToLowerCase(results.queryone, pDBType), arrKeyToLowerCase(results.querytwo, pDBType), error);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231029', 'Error in ExecuteQueryWithPagingCount function', error);
                    return pCallback(null, error);
                }
            });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231030', 'Error in ExecuteQueryWithPagingCount function', error);
        return pCallback(null, error);
    }
}

// Execute the raw SQL procedure 
function ExecuteProcedure(pTranDB, pTrx, pProcedureName, pLogInfo, pDBType, pBindParams, pCallback) {
    try {
        var reqTorusRdbms = require('./TorusRdbms');
        reqInstanceHelper.PrintInfo(serviceName, 'Inside ExecuteProcedure', pLogInfo);
        //enbale dbms out put print line logs
        EnableDBMSOutputLines();

        function EnableDBMSOutputLines() {
            try {
                reqInstanceHelper.PrintInfo(serviceName, 'Inside EnableDBMSOutputLines', pLogInfo);
                var query = pTranDB.raw("BEGIN DBMS_OUTPUT.enable(); END;", {});
                if (pTrx) {
                    query = query.transacting(pTrx);
                }
                _PrintQuery(pLogInfo, 'Query :' + query.toSQL().sql.replaceAll(process.env.PCIDSS_KEY, '**********'));
                // _PrintQuery(pLogInfo, 'InputParams :' + JSON.stringify(query.toSQL().bindings));
                query.then((result) => {
                    ProcedureExecution();
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231114', 'Error in EnableDBMSOutputLines function', err);
            }
        }

        function ProcedureExecution() {
            try {
                reqInstanceHelper.PrintInfo(serviceName, 'Inside ProcedureExecution', pLogInfo);
                var bindIn = reqTorusRdbms.direction.BIND_IN;
                var cursor = reqTorusRdbms.type.CURSOR;
                var resultParams = [];
                var isCursorArr = [];
                var bindParamKeys = Object.keys(pBindParams);

                var storedProcedure = pProcedureName;
                var resParams = '';

                // if (pDBType == 'oracledb') {
                //     pTranDB.client.driver.maxRows = 10000;
                // }
                for (var i = 0; i < bindParamKeys.length; i++) {
                    var currParam = bindParamKeys[i];
                    var dir = pBindParams[currParam].dir;
                    var type = pBindParams[currParam].type;
                    if (bindIn != dir) {
                        resultParams.push(currParam);
                        if (type == cursor) {
                            isCursorArr.push(true);
                        } else {
                            isCursorArr.push(false);
                        }
                    }
                    //for prepare procedure params
                    if (i == 0) {
                        resParams = currParam + '=> :' + currParam;
                    } else {
                        resParams = resParams + ',' + currParam + '=> :' + currParam;
                    }
                }
                storedProcedure = storedProcedure + '(' + resParams + ');';
                var query = pTranDB.raw("BEGIN " + storedProcedure + " END;", pBindParams);
                if (pTrx) {
                    query = query.transacting(pTrx);
                }
                _PrintQuery(pLogInfo, 'Query :' + query.toSQL().sql.replaceAll(process.env.PCIDSS_KEY, '**********'));
                _PrintQuery(pLogInfo, 'InputParams :' + JSON.stringify(query.toSQL().bindings));
                query.then(function (result, error) {
                    try {
                        if (error) {
                            PrintDBMSOutputLines(pTranDB, pLogInfo, pDBType, function (res) {
                                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231106', 'Error in ExecuteSQLProcedure function', error);
                                return pCallback(null, error);
                            });
                        } else {
                            PrintDBMSOutputLines(pTranDB, pLogInfo, pDBType, function (res) {
                                try {
                                    var r = 0;
                                    var finalResult = {};
                                    if (r < result.length) {
                                        getResultSet(result[r]);
                                    } else {
                                        return pCallback(finalResult, error);
                                    }

                                    function getResultSet(resultSet) {
                                        try {
                                            var resultParam = resultParams[r];
                                            var isCursor = isCursorArr[r];
                                            finalResult[resultParam] = {};
                                            r++;
                                            if (isCursor) {
                                                resultSet.getRows(10000, function (error, rows) {
                                                    try {
                                                        if (error) {
                                                            reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231107', 'Error in ExecuteSQLProcedure function', error);
                                                        } else {
                                                            var strLength = '0';
                                                            if (pDBType.toLowerCase() == 'pg' || pDBType.toLowerCase() == 'mysql') {
                                                                strLength = rows.length;
                                                                finalResult[resultParam].rows = arrKeyToLowerCase(rows, pDBType);
                                                            } else if (pDBType.toLowerCase() == 'oracledb') {
                                                                finalResult[resultParam].rows = arrKeyToLowerCase(rows, pDBType);
                                                                if (finalResult[resultParam].rows.length > 0) {
                                                                    finalResult[resultParam].fields = getfields(rows);
                                                                } else {
                                                                    finalResult[resultParam].fields = [];
                                                                }
                                                                strLength = finalResult[resultParam].rows.length;
                                                            } else {
                                                                finalResult[resultParam].rows = [];
                                                                finalResult[resultParam].fields = [];
                                                            }
                                                            if (r < result.length) {
                                                                getResultSet(result[r]);
                                                            } else {
                                                                return pCallback(finalResult, error);
                                                            }
                                                        }
                                                    } catch (error) {
                                                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231108', 'Error in ExecuteSQLProcedure function', error);
                                                        return pCallback(null, error);
                                                    }
                                                });
                                            } else {
                                                finalResult[resultParam] = resultSet;
                                                if (r < result.length) {
                                                    getResultSet(result[r]);
                                                } else {
                                                    return pCallback(finalResult, error);
                                                }
                                            }
                                        } catch (error) {
                                            reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231109', 'Error in ExecuteSQLProcedure function', error);
                                            return pCallback(null, error);
                                        }
                                    }
                                } catch (error) {
                                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231122', 'Error in PrintDBMSOutputLines function', error);
                                }
                            });
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231110', 'Error in ExecuteSQLProcedure function', error);
                        return pCallback(null, error);
                    }
                }).catch(function (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231111', 'Error in ExecuteSQLProcedure function', error);
                    return pCallback(null, error);
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231123', 'Error in ProcedureExecution function', error);
            }
        }

        //append the stored procedure logs into pLogInfo and print  
        function PrintDBMSOutputLines(pTranDB, pLogInfo, pDBType, callback) {
            try {
                reqInstanceHelper.PrintInfo(serviceName, 'inside PrintDBMSOutputLines', pLogInfo);
                var query = pTranDB.raw("BEGIN DBMS_OUTPUT.GET_LINE(:ln, :st); END;", {
                    ln: { dir: reqTorusRdbms.direction.BIND_OUT, type: reqTorusRdbms.type.STRING, maxSize: 32767 },
                    st: { dir: reqTorusRdbms.direction.BIND_OUT, type: reqTorusRdbms.type.NUMBER }
                });
                _PrintQuery(pLogInfo, 'Query :' + query.toSQL().sql.replaceAll(process.env.PCIDSS_KEY, '**********'));
                // _PrintQuery(pLogInfo, 'InputParams :' + JSON.stringify(query.toSQL().bindings));
                if (pTrx) {
                    query = query.transacting(pTrx);
                }
                query.then(function (result, error) {
                    try {
                        if (error) {
                            reqInstanceHelper.PrintError(serviceName, pLogInfo, 'errcode', 'errmsg', error);
                            return callback();
                        } else if (result[1] == 1) { // no more output
                            reqInstanceHelper.PrintInfo(serviceName, 'no more dbms print', pLogInfo);
                            return callback();
                        } else {
                            //console.log(result[0]);
                            reqInstanceHelper.PrintInfo(serviceName, result[0], pLogInfo);
                            return PrintDBMSOutputLines(pTranDB, pLogInfo, pDBType, callback);
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231111', 'Error in ExecuteSQLProcedure function', error);
                        return callback(null, error);
                    }
                }).catch(function (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231111', 'Error in ExecuteSQLProcedure function', error);
                    return callback(null, error);
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231113', 'Error in PrintDBMSOutputLines function', error);
            }
        }

    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231112', 'Error in ExecuteSQLProcedure function', error);
        return pCallback(null, error);
    }
}

function _wrapRawQuery(pTranDB, pQuery, pDBType) {
    try {
        if (pDBType.toLowerCase() == 'oracledb') {
            return pTranDB().from(pTranDB.raw('(' + pQuery + ')'));
        } else {
            return pTranDB().from(pTranDB.raw('(' + pQuery + ') as rawquery'));
        }
        // return pTranDB.raw(pQuery);
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231031', 'Error in _wrapRawQuery function', error);
    }
}

function _PrintQuery(pLogInfo, pQuery) {
    try {
        reqInstanceHelper.PrintInfo(serviceName, pQuery, pLogInfo);
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231032', 'Error in _PrintQuery function', error);
    }
}

//get fileld for oracledb
function getfields(pArr) {
    try {
        var arrForReturn = [];
        //for (var i = 0; i < pArr.length; i++) {
        var obj = pArr[0];
        for (var key in obj) {
            var objNew = {};
            var strUpperCaseKey = key.toUpperCase();
            strUpperCaseKey = strUpperCaseKey;
            //objNew[strUpperCaseKey] = key;
            //  }
            objNew.name = strUpperCaseKey;
            arrForReturn.push(objNew);
        }
        return arrForReturn;
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231034', 'Error in getfields function', error);
        return arrForReturn;
    }
}

// this will return object with keys in uppercase
function arrKeyToLowerCase(pArr, pDBType) {
    try {
        var arrForReturn = [];
        if (!pArr) {
            return arrForReturn;
        }
        for (var i = 0; i < pArr.length; i++) {
            var obj = pArr[i];
            var objNew = new Object();
            for (var key in obj) {
                var strLowerCaseKey = key.toLowerCase();
                if (pDBType.toLowerCase() == 'oracledb') {
                    if (obj[key] == null) {
                        objNew[strLowerCaseKey] = '';
                    } else {
                        objNew[strLowerCaseKey] = obj[key];
                    }
                } else {
                    objNew[strLowerCaseKey] = obj[key];
                }
            }
            arrForReturn.push(objNew);
        }
        return arrForReturn;
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231035', 'Error in arrKeyToLowerCase function', error);
    }
}

function knexTranInsertUpdate(pKnex, pTrx, pTableDetails, pDBType, callback) {
    try {
        //pKnex.transaction(function DoInsertTran(pTrx) {
        var updateQuery = '';
        if (pTableDetails[1]) {
            delete pTableDetails[1].values.TRNA_ID;
            updateQuery = pKnex(_ChangeCase(pDBType, pTableDetails[1].tableName)).transacting(pTrx).update(_ChangeObjCase(pDBType, pTableDetails[1].values));
            var conditions1 = pTableDetails[1].conditions;
            if (conditions1.length) {
                for (var i = 0; i < conditions1.length; i++) {
                    if (i == 0) {
                        updateQuery.where(_ChangeCase(pDBType, conditions1[i].column), conditions1[i].value);
                    } else {
                        updateQuery.andWhere(_ChangeCase(pDBType, conditions1[i].column), conditions1[i].value);
                    }
                }
            }
        }

        return pKnex(_ChangeCase(pDBType, pTableDetails[0].tableName)).transacting(pTrx).insert(_ChangeObjCase(pDBType, pTableDetails[0].values))
            .returning('*')
            .then(function (row) {
                try {
                    console.log(pTableDetails[0].tableName + ' inserted.');
                    var insertedVal = row[0];
                    if (pTableDetails[1]) {
                        return updateQuery.then(function () {
                            console.log(pTableDetails[1].tableName + ' updated..');
                        });
                    }
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231125', 'Error in knexTranInsertUpdate function', error);
                }
            })
            .then(function CallbackDoInsertTranSuccess() {
                console.log('done.');
                return callback('SUCCESS');
            })
            .catch(function CallbackDoInsertTranFail(error) {
                console.log('failed : ' + error.stack);
                return callback('FAILURE');
            });
        //});
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231126', 'Error in knexTranInsertUpdate function', error);
    }
}

/*  pKnex is knex connection
    pTableDetails = {tableName : 'name', conditions : [{column : 'col1', value : ['val1', 'val2',...]}, {column : 'col2', value : ['val1', 'val2',...]}]}
    this is for normal delete
    */
function knexDeleteMulti(pKnex, pTableDetails, pDBType, callback) {
    try {
        var query = '';
        if (pTableDetails) {
            query = pKnex(_ChangeCase(pDBType, pTableDetails.tableName));
            var conditions = pTableDetails.conditions;
            if (conditions.length) {
                for (var i = 0; i < conditions.length; i++) {
                    if (i == 0) {
                        query.whereIn(_ChangeCase(pDBType, conditions[i].column), conditions[i].value);
                    } else {
                        query.andWhereIn(_ChangeCase(pDBType, conditions[i].column), conditions[i].value);
                    }
                }
            }
        }
        if (query) {
            var delqry = query.del();
            // query.then(function (result) {
            runQuery(delqry, objLogInfo, function (result) {
                try {
                    return callback('SUCCESS');
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231038', 'Error in knexDeleteMulti function', error);
                    return callback('FAILURE', error);
                }
            }).catch(function (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231039', 'Error in knexDeleteMulti function', error);
                return callback('FAILURE', error);
            });
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231040', 'Error in knexDeleteMulti function', error);
        return callback('FAILURE', error);
    }
}

function knexTranDeleteUpdate(pKnex, pTrx, pTableDetails, callback) {
    try {
        var updateQuery = '';
        if (pTableDetails[1]) {
            delete pTableDetails[1].values.TRNA_ID;
            updateQuery = pKnex(_ChangeCase(pDBType, pTableDetails[1].tableName)).transacting(pTrx).update(_ChangeCase(pDBType, pTableDetails[1].values));
            var conditions1 = pTableDetails[1].conditions;
            if (conditions1.length) {
                for (var i = 0; i < conditions1.length; i++) {
                    if (i == 0) {
                        updateQuery.where(_ChangeCase(pDBType, conditions1[i].column), conditions1[i].value);
                    } else {
                        updateQuery.andWhere(_ChangeCase(pDBType, conditions1[i].column), conditions1[i].value);
                    }
                }
            }
        }

        var deleteQuery = '';
        if (pTableDetails[0]) {
            deleteQuery = pKnex(_ChangeCase(pDBType, pTableDetails[0].tableName)).transacting(pTrx);
            var conditions = pTableDetails[0].conditions;
            if (conditions.length) {
                for (var i = 0; i < conditions.length; i++) {
                    if (i == 0) {
                        deleteQuery.whereIn(_ChangeCase(pDBType, conditions[i].column), conditions[i].value);
                    } else {
                        deleteQuery.andWhereIn(_ChangeCase(pDBType, conditions[i].column), conditions[i].value);
                    }
                }
            }
        }

        if (deleteQuery) {
            deleteQuery.del();
            return deleteQuery.then(function (result) {
                console.log(deleteQuery + ' is done.');
                if (updateQuery) {
                    return updateQuery.then(function (result) {
                        console.log(updateQuery + 'is done.');
                    });
                }
            })
                .then(function CallbackDoInsertTranSuccess() {
                    console.log('done.');
                    return callback('SUCCESS');
                })
                .catch(function CallbackDoInsertTranFail(error) {
                    console.log('failed : ' + error.stack);
                    return callback('FAILURE');
                });
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231127', 'Error in knexTranDeleteUpdate function', error);
    }

}

function getTransactionScope(pKnex, pLogInfo, callback) {
    try {
        pKnex.transaction(function (trx) {
            // trx.raw('SET TRANSACTION ISOLATION LEVEL READ COMMITTED').then(function () {
            return callback(trx);
            // });
            //return callback(trx);
            // return callback(trx.raw('set transaction isolation level serializable;'));
        }).catch(function (error) {
            reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231041', 'Error in getTransactionScope function', error);
            // if (!global.DisconnInProgress && checkErrType(error)) {
            //     console.log('-------------destory called');
            //     if (!pLogInfo) {
            //         pLogInfo = {};
            //     }
            //     pLogInfo.RestartErrorObj = error.stack;
            //     reqInstanceHelper.restartSvc(pLogInfo);
            // } else {
            //     // return callback(error);
            // }
            return callback(error);
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-231042', 'Error in getTransactionScope function', error);
        return callback(error);
    }
}

function Commit(pTrx, pIsCommit, pCallback) {
    try {
        var co = require("co");
        var q = require('q');
        var Q = q.defer();
        co(function* () {
            if (pIsCommit) {
                yield pTrx.commit();
            } else {
                yield pTrx.rollback();
            }
            Q.resolve(pCallback('SUCCESS'));
        }).catch(function (error) {
            Q.reject(pCallback(error));
        });
        return Q.promise;
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231043', 'Error in Commit function', error);
        return pCallback(error);
    }
}

function checkConnection(pClient, knex, pLogInfo, callback) {
    try {
        if (!pLogInfo) {
            pLogInfo = {};
        }
        if (!pLogInfo.atmptCount) {
            pLogInfo.atmptCount = 0;
        }
        if (pLogInfo.skipSampleqry) {
            reqInstanceHelper.PrintInfo(serviceName, 'Skip executing sample query ', pLogInfo);
            return callback('SUCCESS', knex);
        } else {
            reqInstanceHelper.PrintInfo(serviceName, 'Executing sample query ', pLogInfo);
            var query = '';
            switch (pClient) {
                case 'pg':
                    query = 'SET timezone="UTC"';
                    break;
                case 'mysql':
                    query = 'select 1 as result';
                    break;
                case 'oracledb':
                    //query = 'select 1 as result from dual';
                    // query = 'SET TRANSACTION ISOLATION LEVEL SERIALIZABLE';
                    query = "alter session set time_zone='0:0'";
                    break;
            }
            // 5-Second to execute sample query 
            // knex.destroy(function () {
            if (knex) {
                var query = knex.raw(query).timeout(5000);
                runQuery(query, pLogInfo, function (res, error) {
                    if (!error) {
                        return callback('SUCCESS', knex);
                    }
                });


                // return callback('SUCCESS', knex);

                // knex.raw(query).timeout(5000)
                //     .then(function (result) {
                //         reqInstanceHelper.PrintInfo(serviceName, 'Sample query executed sucessfully ', pLogInfo);
                //         pLogInfo.atmptCount = 0;
                //         return callback('SUCCESS', knex);
                //     })
                //     .catch(function (error) {
                //         reqInstanceHelper.PrintInfo(serviceName, 'ERR-KNEX-231044 Error in checkConnection function ' + error, pLogInfo);
                //         pLogInfo.atmptCount = pLogInfo.atmptCount + 1;
                //         if (pLogInfo.atmptCount <= 11) {
                //             setTimeout(() => {
                //                 reqInstanceHelper.PrintInfo(serviceName, 'Retrying sample query attempt | ' + pLogInfo.atmptCount + '/10', pLogInfo);
                //                 checkConnection(pClient, knex, pLogInfo, callback);
                //             }, 1000);
                //         } else {
                //             if (!global.DisconnInProgress && checkknexerr(error)) {
                //                 reqInstanceHelper.PrintInfo(serviceName, 'Destroy called ', pLogInfo);
                //                 if (!pLogInfo) {
                //                     pLogInfo = {};
                //                 }
                //                 pLogInfo.RestartErrorObj = error;
                //                 reqInstanceHelper.restartSvc(pLogInfo);
                //             } else {
                //                 pLogInfo.atmptCount = 0;
                //                 reqInstanceHelper.PrintInfo(serviceName, 'Retry attempts failed. Connection Not available ', pLogInfo);
                //                 return callback('FAILURE');
                //             }
                //         }
                //     });
            } else {
                reqInstanceHelper.PrintInfo(serviceName, 'knex connection variable not available ', pLogInfo);
                return callback('FAILURE');
            }
        }

        // });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-KNEX-231045', 'Error in checkConnection function', error);
        return callback('FAILURE');
    }
}

// Execute the raw SQL query with params 
function ExecuteSQLQueryWithParams(pTranDB, pTrx, pQueryObj, pLogInfo, pDBType, pCallback) {
    try {
        if (pDBType == 'oracledb') {
            // pTranDB.client.driver.maxRows = 10000;
            //for number data type floting point issue (so get the value as string)
            // pLogInfo.fetchAsString=true - This param is used to get number data result as string Ex: 32.45 necomes '32.45'
            pTranDB.client.driver.fetchAsString = [];
            if (pLogInfo && pLogInfo.fetchAsString) {
                pTranDB.client.driver.fetchAsString = [pTranDB.client.driver.NUMBER];
                pTranDB.client.fetchAsString = [pTranDB.client.driver.NUMBER];
                // pTranDB.client.fetchAsString = [pTranDB.client.driver.DATE];
            }
        }
        var query = pTranDB.raw(pQueryObj.query, pQueryObj.params);
        _PrintQuery(pLogInfo, 'Query :' + query.toSQL().sql.replaceAll(process.env.PCIDSS_KEY, '**********'));
        // _PrintQuery(pLogInfo, 'Params :' + JSON.stringify(pQueryObj.params));
        if (pTrx) {
            query = query.transacting(pTrx);
        }
        // query.then(function (res, error) {
        runQuery(query, pLogInfo, function (res, error) {
            try {
                if (pLogInfo && pLogInfo.fetchAsString) {
                    delete pLogInfo.fetchAsString;
                }
                if (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-987006', 'Error in ExecuteSQLQueryWithParams function', error);
                    return pCallback(null, error);
                }
                //console.log('Error ' + error);
                else {
                    var strLength = '0';
                    if ((pDBType.toLowerCase() == 'pg' || pDBType.toLowerCase() == 'mysql') && res.rows) {
                        strLength = res.rows ? res.rows.length : 0;
                        res.rows = arrKeyToLowerCase(res.rows, pDBType);
                    } else if (pDBType.toLowerCase() == 'oracledb') {
                        var result = {};
                        result.rows = arrKeyToLowerCase(res, pDBType);
                        if (result.rows.length > 0) {
                            result.fields = getfields(res);
                        } else {
                            result.fields = [];
                        }
                        strLength = result.rows.length;
                        _PrintQuery(pLogInfo, 'Returned Rows ' + strLength);
                        return pCallback(result, error);
                    } else {
                        res.rows = [];
                        res.fields = [];
                    }
                    _PrintQuery(pLogInfo, 'Returned Rows ' + strLength);
                    return pCallback(res, error);
                }
                //return res;
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-987003', 'Error in ExecuteSQLQueryWithParams function', error);
                return pCallback(null, error);
            }
        });
        // .catch(function (error) {
        //     reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-987004', 'Error in ExecuteSQLQueryWithParams function', error);
        //     return pCallback(null, error);
        // });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-KNEX-987005', 'Error in ExecuteSQLQueryWithParams function', error);
        return pCallback(null, error);
    }
}


function runQuery(query, pLogInfo, pCallback) {
    reqInstanceHelper.PrintInfo(serviceName, 'Query is executing ', pLogInfo);
    query.then(function (result, error) {
        reqInstanceHelper.PrintInfo(serviceName, 'Query execution done. ', pLogInfo);
        if (pLogInfo && pLogInfo.atmptCount) {
            pLogInfo.atmptCount = 0;
        }
        if (pLogInfo && pLogInfo.fetchAsString) {
            delete pLogInfo.fetchAsString;
        }
        pCallback(result, error);
    }).catch(function (error) {
        reqInstanceHelper.PrintInfo(serviceName, 'ERR-KNEX-231046 Error in query execution ' + error, pLogInfo);
        if (query && query.client && !query.client.transacting) {
            if (checkErrType(error) == 'RETRY_QUERY') {
                //Retrying query
                pLogInfo.atmptCount = pLogInfo.atmptCount + 1;
                if (pLogInfo.atmptCount <= 11) {
                    setTimeout(() => {
                        reqInstanceHelper.PrintInfo(serviceName, 'Retrying sample query attempt | ' + pLogInfo.atmptCount + '/10', pLogInfo);
                        runQuery(query, pLogInfo, pCallback);
                    }, 1000);
                } else {
                    pLogInfo.atmptCount = 0;
                    reqInstanceHelper.PrintInfo(serviceName, 'All retry attempts failed. Cancelling the service. ', pLogInfo);
                    return pCallback(null, error);
                }
            } else {
                pCallback(null, error);
            }
        } else {
            pCallback(null, error);
        }
    });
    // });
}

function GetSchemaDetail(pDBType, objLogInfo) {
    try {
        return new Promise((resolve, reject) => {
            reqRedisInstance.GetRedisConnection(async function (error, redisConnection) {
                var DBKey = 'ORACLE';
                if (pDBType == 'pg') {
                    DBKey = 'POSTGRES';
                }
                if (!objLogInfo.ROUTING_KEY) {
                    objLogInfo.ROUTING_KEY = defaultRoutingKey
                }
                var pKey = `${DBKey}~${objLogInfo.ROUTING_KEY.toUpperCase()}`;
                var res = await redisConnection.get(pKey);
                if (!res) {
                    var defRedKey = `${DBKey}~${defaultRoutingKey.toUpperCase()}`
                    reqInstanceHelper.PrintInfo(serviceName, `key - ${pKey} not found in redis. Going to process with default key - ${defRedKey}`, objLogInfo);
                    res = await redisConnection.get(defRedKey);
                }
                var ParsedConfig = JSON.parse(res);
                var schemaRes = {};
                var schmaDtls = '';
                if (ParsedConfig) {
                    if (pDBType == "oracledb") {
                        schmaDtls = ParsedConfig.OracleServers[0].OracleSchemas;
                    } else {
                        schmaDtls = ParsedConfig.PostgresServers[0].PostgresSchemas;
                    }
                    for (var i = 0; i < schmaDtls.length; i++) {
                        schemaRes[schmaDtls[i].Code] = schmaDtls[i].Schema;
                    }
                } else {
                    reqInstanceHelper.PrintInfo(serviceName, `key - ${pKey} not found in redis.`, objLogInfo);
                }
                resolve(schemaRes);
            });
        });
    } catch (error) {
        console.log(error);
        reject(error)
    }
}

module.exports = {
    GetKnexConnection: getKnexConnection,
    List: List,
    Insert: Insert,
    InsertBulk: InsertBulk,
    Update: Update,
    Delete: Delete,
    ExecuteSQLQuery: ExecuteSQLQuery,
    ExecuteQueryWithPagingCount: ExecuteQueryWithPagingCount,
    ExecuteProcedure: ExecuteProcedure,
    DestroyKnexConnection: DestroyKnexConnection,
    KnexTranInsertUpdate: knexTranInsertUpdate,
    KnexTranDeleteUpdate: knexTranDeleteUpdate,
    KnexDeleteMulti: knexDeleteMulti,
    GetTransactionScope: getTransactionScope,
    Commit: Commit,
    CheckConnection: checkConnection,
    ExecuteSQLQueryWithParams: ExecuteSQLQueryWithParams,
    ListWithoutCache: ListWithoutCache,
    InsertwithAudit: InsertwithAudit,
    UpdateWithAudit: UpdateWithAudit,
    InsertBulkWithAudit: InsertBulkWithAudit,
    GetSchemaDetail: GetSchemaDetail
};
/************ End of File ************/