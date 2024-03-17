/*
  @Decsription: To create the FX DB instance based on SERVICE_MODEL setup in redis - FX DB can be CASS or PG or ORA  
*/

// Require dependencies
var reqMoment = require('moment');
var reqInstanceHelper = require('../common/InstanceHelper');
var reqCassandraInstance = require('./CassandraInstance');
var reqTranDBInstance = require('./TranDBInstance');
var reqKnexHelper = require('./db/KnexHelper');
var reqDateFormatter = require('../common/dateconverter/DateFormatter');
var dbInstanceSession = {};
var serviceName = 'DBInstance';
var objLogInfo = null;

// To call CreateFxDBInstance for LITE model
function createFxDBInstance(pOrm, pRedisKey, pVal, callback) {
    try {
        reqTranDBInstance.CreateFxDBInstance(pOrm, pRedisKey, pVal, {}, callback);
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230041', 'Error in createFxDBInstance function', error);
    }
}

// To get FX DB connection based on SERVICE_MODEL 
// For LITE/LITE_KAFKA - pg or ora
// ULTIMATE/PROFESSIONAL - cassandra
function GetFXDBConnection(pHeader, pSchema, pLogInfo, pCallback) {
    try {
        reqInstanceHelper.PrintInfo(serviceName, 'Connection request for | ' + pSchema, pLogInfo);
        if (!pHeader) {
            pHeader = {};
        }
        pHeader.LOG_INFO = pLogInfo;
        var serviceModel = dbInstanceSession['SERVICE_MODEL'];
        if (serviceModel) {
            if (serviceModel.TYPE == 'LITE' || serviceModel.TYPE == 'LITE_KAFKA') {
                reqTranDBInstance.GetFXTranDBConn(pHeader, pSchema, false, function callback(pKnexClient) {
                    try {
                        if (pKnexClient) {
                            pKnexClient.DbType = 'SQLDB';
                        }
                        return pCallback(pKnexClient);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230042', 'Error in GetFXDBConnection function', error);
                    }
                });
            } else { //if (serviceModel.TYPE == 'ULTIMATE') {
                reqCassandraInstance.GetCassandraConn(pHeader, pSchema, function callback(pCasClient) {
                    try {
                        var cassandraClient = {
                            Client: pCasClient,
                            DbType: 'NOSQLDB'
                        };
                        return pCallback(cassandraClient);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230043', 'Error in GetFXDBConnection function', error);
                    }
                });
            }
        } else {
            reqCassandraInstance.GetCassandraConn(pHeader, pSchema, function callback(pCasClient) {
                try {
                    var cassandraClient = {
                        Client: pCasClient,
                        DbType: 'NOSQLDB'
                    };
                    return pCallback(cassandraClient);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230044', 'Error in GetFXDBConnection function', error);
                }
            });
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230045', 'Error in GetFXDBConnection function', error);
    }
}


function GetFXDBConnectionWithScopeParam(pHeader, pSchema, pscope, pLogInfo, pCallback) {
    try {
        reqInstanceHelper.PrintInfo(serviceName, 'Connection request for | ' + pSchema, pLogInfo);
        if (!pHeader) {
            pHeader = {};
        }
        pHeader.LOG_INFO = pLogInfo;
        reqTranDBInstance.GetFXTranDBConn(pHeader, pSchema, pscope, function callback(pKnexClient) {
            try {
                if (pKnexClient) {
                    pKnexClient.DbType = 'SQLDB';
                }
                return pCallback(pKnexClient);
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230042', 'Error in GetFXDBConnection function', error);
            }
        });


    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230045', 'Error in GetFXDBConnection function', error);
    }
}

// To get table data from FX DB - SQL/NOSQL
function GetTableFromFXDB(pClient, pTableName, pColumnList, pCond, pLogInfo, pCallback) {
    try {
        if (pClient && pClient.DbType == 'SQLDB') {
            if (pLogInfo) {
                pLogInfo.columnList = pColumnList;
            } else {
                pLogInfo = {};
                pLogInfo.columnList = pColumnList;
            }
            reqTranDBInstance.GetTableFromTranDB(pClient, pTableName, pCond, pLogInfo, function callback(pResult, pError) {
                try {
                    var result = {};
                    result.rows = pResult;
                    return pCallback(pError, result);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230046', 'Error in GetTableFromFXDB function', error);
                }
            });
        } else if (pClient && pClient.DbType == 'NOSQLDB') {
            reqCassandraInstance.GetTableNoSqlDb(pClient.Client, pTableName, pColumnList, pCond, pLogInfo, function callback(pResult, pError) {
                try {
                    return pCallback(pError, pResult);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230047', 'Error in GetTableFromFXDB function', error);
                }
            });
        } else {
            return pCallback('Connection Not available', null);
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230048', 'Error in GetTableFromFXDB function', error);
    }
}


// To get table data from FX DB without cache - SQL/NOSQL
function GetTableFromFXDBNoCache(pClient, pTableName, pColumnList, pCond, pLogInfo, pCallback) {
    try {
        reqInstanceHelper.PrintInfo(serviceName, 'GetTableFromFXDBNoCache called', objLogInfo);
        if (pClient && pClient.DbType == 'SQLDB') {
            if (pLogInfo) {
                pLogInfo.columnList = pColumnList;
            } else {
                pLogInfo = {};
                pLogInfo.columnList = pColumnList;
            }
            reqTranDBInstance.GetTableFromTranDBNoCache(pClient, pTableName, pCond, pLogInfo, function callback(pResult, pError) {
                try {
                    var result = {};
                    result.rows = pResult;
                    return pCallback(pError, result);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230046', 'Error in GetTableFromFXDB function', error);
                }
            });
        } else if (pClient && pClient.DbType == 'NOSQLDB') {
            reqCassandraInstance.GetTableNoSqlDbNoCache(pClient.Client, pTableName, pColumnList, pCond, pLogInfo, function callback(pResult, pError) {
                try {
                    return pCallback(pError, pResult);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230047', 'Error in GetTableFromFXDB function', error);
                }
            });
        }
        else {
            return pCallback('Connection Not available', null);
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230048', 'Error in GetTableFromFXDB function', error);
    }
}

// Execute raw query
function ExecuteQuery(pClient, pQuery, pLogInfo, pCallback) {
    try {
        if (pClient && pClient.DbType == 'SQLDB') {
            if (pQuery.indexOf('allow filtering') != -1) {
                pQuery = pQuery.replace('allow filtering', '');
            }
            reqTranDBInstance.ExecuteSQLQuery(pClient, pQuery, pLogInfo, function callback(pResult, pError) {
                try {
                    return pCallback(pError, pResult);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-REF-230049', 'Error in ExecuteQuery function', error);
                }
            });
        } else if (pClient && pClient.DbType == 'NOSQLDB') {
            reqCassandraInstance.ExecuteQuery(pClient.Client, pQuery, pLogInfo, function callback(pResult, pError) {
                try {
                    return pCallback(pError, pResult);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-REF-230050', 'Error in ExecuteQuery function', error);
                }
            });
        } else {
            return pCallback('DB Connection eroor');
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-REF-230051', 'Error in ExecuteQuery function', error);
    }
}

// Execute raw query with paging params in TRAN DB
function ExecuteQueryWithPagingCount(pSession, pQuery, pPageNo, pPageSize, pLogInfo, pCallback) {
    try {
        if (pSession.DBConn.Orm == 'knex') {
            reqKnexHelper.ExecuteQueryWithPagingCount(pSession.DBConn.DBType, pSession.DBConn.Connection, pSession.trx, pQuery, pPageNo, pPageSize, pLogInfo, function (pResult, pCount, pError) {
                try {
                    pCallback(pResult, pCount, pError);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-REF-230052', 'Error in ExecuteQueryWithPagingCount function', error);
                }
            });
        } else if (pSession.DBConn.Orm == 'something') {

        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-REF-230053', 'Error in ExecuteQueryWithPagingCount function', error);
    }
}

function InsertFXDB(pClient, pTableName, pRows, pLogInfo, pCallback, pDataType) {
    try {
        if (pClient.DbType == 'SQLDB') {
            if (pDataType && pDataType.length) { //this is for uuid and date creation from datatype
                var i = 0;
                doInsert(pRows[i]);

                function doInsert(objRow) {
                    i++;
                    var rowColumns = Object.keys(objRow);
                    for (var j = 0; j < rowColumns.length; j++) {
                        var colName = rowColumns[j].toString();
                        switch (pDataType[j].toUpperCase()) {
                            case 'UUID':
                                objRow[colName] = reqInstanceHelper.Guid();
                                break;
                            case 'SYSDATE':
                                var headers = {
                                    routingkey: pClient.routingkey
                                };
                                objRow[colName] = reqDateFormatter.GetCurrentDate(headers);
                                break;
                        }
                    }
                    if (i < pRows.length) {
                        doInsert(pRows[i]);
                    }
                }
            }
            reqTranDBInstance.InsertTranDB(pClient, pTableName, pRows, pLogInfo, function callback(pResult, pError) {
                try {
                    return pCallback(pError, pResult);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-REF-230054', 'Error in InsertFXDB function', error);
                }
            });
        } else if (pClient.DbType == 'NOSQLDB') {
            reqCassandraInstance.InsertNoSqlDb(pClient.Client, pTableName, pRows, pLogInfo, function callback(pResult, pError) {
                try {
                    return pCallback(pError, pResult);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-REF-230055', 'Error in InsertFXDB function', error);
                }
            }, pDataType);
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-REF-230056', 'Error in InsertFXDB function', error);
    }
}

function UpdateFXDB(pClient, pTableName, pRows, pCond, pLogInfo, pCallback) {
    try {
        if (pClient.DbType == 'SQLDB') {
            reqTranDBInstance.UpdateTranDB(pClient, pTableName, pRows, pCond, pLogInfo, function callback(pResult, pError) {
                try {
                    return pCallback(pError, pResult);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-REF-230057', 'Error in UpdateFXDB function', error);
                }
            });
        } else if (pClient.DbType == 'NOSQLDB') {
            reqCassandraInstance.UpdateNoSqlDb(pClient.Client, pTableName, pRows, pCond, pLogInfo, function callback(pResult, pError) {
                try {
                    return pCallback(pError, pResult);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-REF-230058', 'Error in UpdateFXDB function', error);
                }
            });
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-REF-230059', 'Error in UpdateFXDB function', error);
    }
}

function DeleteFXDB(pClient, pTableName, pCond, pLogInfo, pCallback) {
    try {
        if (pClient.DbType == 'SQLDB') {
            reqTranDBInstance.DeleteTranDB(pClient, pTableName, pCond, pLogInfo, function callback(pResult, pError) {
                try {
                    return pCallback(pError, pResult);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-REF-230060', 'Error in DeleteFXDB function', error);
                }
            });
        } else if (pClient.DbType == 'NOSQLDB') {
            reqCassandraInstance.DeleteNoSqlDb(pClient.Client, pTableName, pCond, pLogInfo, function callback(pResult, pError) {
                try {
                    return pCallback(pError, pResult);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-REF-230061', 'Error in DeleteFXDB function', error);
                }
            });
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-REF-230062', 'Error in DeleteFXDB function', error);
    }
}

function loadServiceModel(pRedisKey, pVal, callback) {
    try {
        var result = {
            status: 'SUCCESS'
        };
        dbInstanceSession[pRedisKey] = pVal;
        reqDateFormatter.AssignServiceModel();
        return callback(result);
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-REF-230063', 'Error in loadServiceModel function', error);
        return callback(error);
    }
}

// Get the schema details and prepare the search path query and execute it. 
// only for PG
function setSearchPath(pClient, pSearchPath, objLogInfo) {
    return new Promise(async (resolve, reject) => {
        try {
            await reqTranDBInstance.SetSearchPathPg(pClient, pSearchPath, objLogInfo);
            resolve("SUCCESS");
        } catch (error) {
            reject(error)
        }
    })
}


function GetDecryptedData(pClient, pData, objLogInfo) {
    return new Promise(async (resolve, reject) => {
        try {
            var data = await reqTranDBInstance.GetDecryptedDataFromDB(pClient, pData, objLogInfo)
            if (data && data.rows.length) {
                resolve(data.rows[0].data)
            }
        } catch (error) {
            reject(error)
        }
    })
}

function ExecuteSQLQueryWithParams(pSession, pQuery, pLogInfo, pCallback) {
    try {
        reqTranDBInstance.ExecuteSQLQueryWithParams(pSession, pQuery, pLogInfo, function (pResult, pError) {
            try {
                pCallback(pResult, pError)
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-REF-230064', 'Error inside SQL Query Function', error);
            }
        })
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-REF-230065', 'Error in Calling SQL Query Function', error);
    }
}

module.exports = {
    CreateFxDBInstance: createFxDBInstance,
    GetFXDBConnection: GetFXDBConnection,
    GetTableFromFXDB: GetTableFromFXDB,
    ExecuteQuery: ExecuteQuery,
    InsertFXDB: InsertFXDB,
    UpdateFXDB: UpdateFXDB,
    DeleteFXDB: DeleteFXDB,
    LoadServiceModel: loadServiceModel,
    DBInstanceSession: dbInstanceSession,
    ExecuteQueryWithPagingCount: ExecuteQueryWithPagingCount,
    GetTableFromFXDBNoCache: GetTableFromFXDBNoCache,
    setSearchPath: setSearchPath,
    GetDecryptedData: GetDecryptedData,
    ExecuteSQLQueryWithParams: ExecuteSQLQueryWithParams,
    GetFXDBConnectionWithScopeParam: GetFXDBConnectionWithScopeParam
};