/*
  @Decsription: To process cassandra related functions
  @Last Error Code : 'ERR-CAS-233052' 
*/

var reqInstanceHelper = require('../../common/InstanceHelper');
var reqCacheRedisInstance = require('../CacheRedisInstance');
var reqEncryptionInstance = require('../../common/crypto/EncryptionInstance');
var cltCacheTables = ['tenant_setup'];
var serviceName = 'CassandraHelper';

var objLogInfo = null;

// GetTableData from NoSql-Cassandra DB
function GetTableData(pHeaders, pClient, pTableName, pColumnList, pCond, pLogInfo, pCallback) {
    try {
        var strColumns = '*';
        if (pColumnList.length) {
            strColumns = '';
            for (var i = 0; i < pColumnList.length; i++) {
                if (i == 0) {
                    strColumns = strColumns + pColumnList[i].toString();
                } else {
                    strColumns = strColumns + ',' + pColumnList[i].toString();
                }
            }
        }
        var bindings = [];
        var query = 'SELECT ' + strColumns + ' FROM ' + pTableName;
        var params = [];
        var conditionColumns = Object.keys(pCond);
        for (var j = 0; j < conditionColumns.length; j++) {
            var colName = conditionColumns[j].toString();
            var dataType = typeof pCond[colName];
            bindings.push(pCond[colName]);
            if (dataType == 'object') {
                if (j == 0) {
                    query = query + ' WHERE ' + colName + ' IN ?';
                } else {
                    query = query + ' AND ' + colName + ' IN ?';
                }
            } else {
                if (j == 0) {
                    query = query + ' WHERE ' + colName + ' = ?';
                } else {
                    query = query + ' AND ' + colName + ' = ?';
                }
            }
            if (j == (conditionColumns.length - 1)) {
                query = query + ' ALLOW FILTERING';
            }
        }
        reqInstanceHelper.PrintInfo(serviceName, 'Select query : ' + query, pLogInfo);
        reqInstanceHelper.PrintInfo(serviceName, 'Condition params are ' + bindings, pLogInfo);
        var routingkey = pHeaders.routingkey;
        if (routingkey) {
            var arrKey = routingkey.split('~');
            //var clientId = arrKey[0].split('-')[1];
            var appId = arrKey[1].split('-')[1];
            var strQuery = query;
            strQuery = query + JSON.stringify(bindings);
            var uniquKey = 'META_CACHE~' + reqEncryptionInstance.EncryptPassword(strQuery);
            var gCacheProperties = false;
            var schema = pClient.schemaName;
            // if (cltCacheTables.indexOf(pTableName.toLowerCase()) > -1) {
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
                                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233054', 'Error in GetCacheFromRedis callback', error);
                                }
                            });
                        } else {
                            doDBQuery();
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233055', 'Error in GetCacheProperties callback', error);
                    }
                });
            } else {
                doDBQuery();
            }
        } else {
            doDBQuery();
        }
        function doDBQuery() {
            pClient.execute(query, bindings, {
                prepare: true
            }, function executeCallback(error, result) {
                try {
                    if (error) {
                        reqInstanceHelper.PrintInfo(serviceName, 'Error occured ' + error, pLogInfo);
                    } else {
                        reqInstanceHelper.PrintInfo(serviceName, 'Returned rows ' + result.rows.length, pLogInfo);
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
                                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'errcode', 'errmsg', error);
                                }
                            });
                        }
                    }
                    return pCallback(result, error);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233001', 'Error in executeCallback function', error);
                }
            });
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233002', 'Error in GetTableData function', error);
        return pCallback(null, error);
    }
}

// GetTableData from NoSql-Cassandra DB NoSql
function GetTableDataNoCache(pHeaders, pClient, pTableName, pColumnList, pCond, pLogInfo, pCallback) {
    try {
        var strColumns = '*';
        if (pColumnList.length) {
            strColumns = '';
            for (var i = 0; i < pColumnList.length; i++) {
                if (i == 0) {
                    strColumns = strColumns + pColumnList[i].toString();
                } else {
                    strColumns = strColumns + ',' + pColumnList[i].toString();
                }
            }
        }
        var bindings = [];
        var query = 'SELECT ' + strColumns + ' FROM ' + pTableName;
        var params = [];
        var conditionColumns = Object.keys(pCond);
        for (var j = 0; j < conditionColumns.length; j++) {
            var colName = conditionColumns[j].toString();
            var dataType = typeof pCond[colName];
            bindings.push(pCond[colName]);
            if (dataType == 'object') {
                if (j == 0) {
                    query = query + ' WHERE ' + colName + ' IN ?';
                } else {
                    query = query + ' AND ' + colName + ' IN ?';
                }
            } else {
                if (j == 0) {
                    query = query + ' WHERE ' + colName + ' = ?';
                } else {
                    query = query + ' AND ' + colName + ' = ?';
                }
            }
            if (j == (conditionColumns.length - 1)) {
                query = query + ' ALLOW FILTERING';
            }
        }
        reqInstanceHelper.PrintInfo(serviceName, 'Select query : ' + query, pLogInfo);
        reqInstanceHelper.PrintInfo(serviceName, 'Condition params are ' + bindings, pLogInfo);
        doDBQuery();

        function doDBQuery() {
            pClient.execute(query, bindings, {
                prepare: true
            }, function executeCallback(error, result) {
                try {
                    if (error) {
                        reqInstanceHelper.PrintInfo(serviceName, 'Error occured ' + error, pLogInfo);
                    } else {
                        reqInstanceHelper.PrintInfo(serviceName, 'Returned rows ' + result.rows.length, pLogInfo);
                    }
                    return pCallback(result, error);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233001', 'Error in executeCallback function', error);
                }
            });
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233002', 'Error in GetTableData function', error);
        return pCallback(null, error);
    }
}
// Insert into NoSql db
function Insert(pClient, pTableName, pRows, pLogInfo, pCallback, pDataType) {
    try {
        var i = 0;
        var strDataType = 'N';
        if (pDataType) {
            if (pDataType.length > 0) {
                strDataType = 'Y';
            }
        }
        doInsert(pRows[i]);

        function doInsert(objRow) {
            i++;
            try {
                var objValues = [];
                var strQuery = 'INSERT INTO ' + pTableName + ' (';
                var rowColumns = Object.keys(objRow);
                strQuery = strQuery + rowColumns.join() + ') ';

                var strValues = ' values ( ';
                for (var j = 0; j < rowColumns.length; j++) {
                    var colName = rowColumns[j].toString();

                    var curValue = '';
                    if (strDataType == 'Y') {
                        switch (pDataType[j].toUpperCase()) {
                            case 'UUID':
                                curValue = 'UUID()';
                                break;
                            case 'SYSDATE':
                                curValue = 'DATEOF(NOW())';
                                break;
                            default:
                                curValue = '?';
                                objValues.push(objRow[colName]);
                                break;
                        }
                    } else {
                        curValue = '?';
                        objValues.push(objRow[colName]);
                    }

                    if (j == 0) {
                        strValues = strValues + curValue;
                    } else {
                        strValues = strValues + ',' + curValue;
                    }

                }
                if (strValues != '') {
                    strQuery = strQuery + strValues + ')';
                }
                reqInstanceHelper.PrintInfo(serviceName, 'Insert query : ' + strQuery, pLogInfo);
                reqInstanceHelper.PrintInfo(serviceName, 'Values : ' + objValues, pLogInfo);
                pClient.execute(strQuery, objValues, {
                    prepare: true
                }, function executeCallback(error, result) {
                    try {
                        if (i == pRows.length) {
                            pCallback(result, error);
                        } else {
                            doInsert(pRows[i]);
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233003', 'Error in executeCallback function', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233004', 'Error in doInsert function', error);
            }
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233005', 'Error in Insert function', error);
        pCallback(null, error);
    }
}

// Update NoSqlDB
function Update(pClient, pTableName, pRows, pCond, pLogInfo, pCallback) {
    try {
        var objValues = [];
        var strQuery = 'UPDATE ' + pTableName;
        var strUpdate = ' SET ';
        var rowColumns = Object.keys(pRows);
        for (var i = 0; i < rowColumns.length; i++) {
            var colName = rowColumns[i].toString();
            objValues.push(pRows[colName]);
            if (i == 0) {
                strUpdate = strUpdate + colName + ' = ?';
            } else {
                strUpdate = strUpdate + ', ' + colName + ' = ?';
            }
            if (i == (rowColumns.length - 1)) {
                strQuery = strQuery + strUpdate;
            }
        }
        var conditionColumns = Object.keys(pCond);
        for (var j = 0; j < conditionColumns.length; j++) {
            var colName = conditionColumns[j].toString();
            var dataType = typeof pCond[colName];
            objValues.push(pCond[colName]);
            if (dataType == 'object') {
                if (j == 0) {
                    strQuery = strQuery + ' WHERE ' + colName + ' IN ?';
                } else {
                    strQuery = strQuery + ' AND ' + colName + ' IN ?';
                }
            } else {
                if (j == 0) {
                    strQuery = strQuery + ' WHERE ' + colName + ' = ?';
                } else {
                    strQuery = strQuery + ' AND ' + colName + ' = ?';
                }
            }
        }
        reqInstanceHelper.PrintInfo(serviceName, 'Update query : ' + strQuery, pLogInfo);
        pClient.execute(strQuery, objValues, {
            prepare: true
        }, function executeCallback(error, result) {
            try {
                pCallback(result, error);
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233006', 'Error in executeCallback function', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233007', 'Error in Update function', error);
        pCallback(null, error);
    }
}

// Delete NoSql Db
function Delete(pClient, pTableName, pCond, pLogInfo, pCallback) {
    try {
        var strQuery = 'DELETE FROM ' + pTableName;
        var objValues = [];
        var conditionColumns = Object.keys(pCond);
        for (var j = 0; j < conditionColumns.length; j++) {
            var colName = conditionColumns[j].toString();
            var dataType = typeof pCond[colName];
            objValues.push(pCond[colName]);
            if (dataType == 'object') {
                if (j == 0) {
                    strQuery = strQuery + ' WHERE ' + colName + ' IN ?';
                } else {
                    strQuery = strQuery + ' AND ' + colName + ' IN ?';
                }
            } else {
                if (j == 0) {
                    strQuery = strQuery + ' WHERE ' + colName + ' = ?';
                } else {
                    strQuery = strQuery + ' AND ' + colName + ' = ?';
                }
            }
        }
        reqInstanceHelper.PrintInfo(serviceName, 'Delete query : ' + strQuery, pLogInfo);
        pClient.execute(strQuery, objValues, {
            prepare: true
        }, function executeCallback(error, result) {
            try {
                pCallback(result, error);
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233008', 'Error in executeCallback function', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233009', 'Error in Delete function', error);
        pCallback(null, error);
    }
}

// Execute Raw Query on NoSql DB
function ExecuteRawQuery(pClient, pQuery, pLogInfo, pCallback) {
    try {
        reqInstanceHelper.PrintInfo(serviceName, 'Raw query : ' + pQuery, pLogInfo);
        pClient.execute(pQuery, function executeCallback(error, result) {
            try {
                pCallback(result, error);
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233010', 'Error in executeCallback function', error);
                pCallback(null, error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-CAS-233011', 'Error in ExecuteRawQuery function', error);
        pCallback(null, error);
    }
}

module.exports = {
    GetTableData: GetTableData,
    Insert: Insert,
    Update: Update,
    Delete: Delete,
    ExecuteRawQuery: ExecuteRawQuery,
    GetTableDataNoCache: GetTableDataNoCache
};
/************ End of File ************/