var q = require('q');
var co = require("co");

var reqLinq = require('node-linq').LINQ;
var selectQueriesJSON = require('./queries/selectQueries.json');
var deleteQueriesJSON = require('./queries/deleteQueries.json');
var deleteAppQueriesJSON = require('./queries/deleteAppQueries.json');
var deleteAppTenantLinkJSON = require('./queries/deleteAppTenantLink.json');
var deleteTenantQueriesJSON = require('./queries/deleteTenantQueries.json');
var deleteClientQueriesJSON = require('./queries/deleteClientQueries.json');
var casssandraConn = {};
var isDeleteApp = false;
var isDeleteTenant = false;
var isDeleteClient = false;
//var reqCassandraInstance = require('../../../../references/helper/CassandraInstance');
var reqCassandraInstance = require('../../../../../torus-references/instance/CassandraInstance');

// this will execute cassandra query
function executecassandra(objSession, pQuery, pParams, pPrepare) {
    var d = q.defer();
    if (objSession == null) {
        console.log("Cassandra session not found...");
    }
    objSession.execute(pQuery, pParams, { prepare: pPrepare }, function (error, result) {
        if (error) {
            console.log(error);
        }
        d.resolve(result);
    });
    return d.promise;
};

// this will return array with keys in uppercase
function arrKeyToUpperCase(pArr, pLogInfo) {
    try {
        var arrForReturn = [];
        for (var i = 0; i < pArr.length; i++) {
            var obj = pArr[i];
            var objNew = new Object();
            var arrKeys = Object.keys(obj);
            for (var j = 0; j < arrKeys.length; j++) {
                var key = arrKeys[j];
                var strUpperCaseKey = key.toUpperCase();
                objNew[strUpperCaseKey] = obj[key];
            }
            arrForReturn.push(objNew);
        }
        return arrForReturn;
    } catch (error) {
        printError(error, 'ERR-FX-12217', pLogInfo);
        return null;
    }
}

// this will form query condition params for execute
function getConditionParams(params, values) {
    var newParams = [];
    for (var i = 0; i < params.length; i++) {
        var param = params[i];
        newParams[i] = values[param] ? values[param] : null;
    }
    return newParams;
}

// this will load all cassandra instances to casssandraConn
function getAllCassandraConn(pHeaders, callback) {
    var cltCasLoaded = false;
    var devCasLoaded = false;
    var depCasLoaded = false;
    var logCasLoaded = false;
    var resCasLoaded = false;
    var pltCasLoaded = false;
    reqCassandraInstance.GetCassandraConn(pHeaders, 'clt_cas', function (pClient) {
        casssandraConn.clt_cas = pClient;
        cltCasLoaded = true;
        successCall();
    });
    reqCassandraInstance.GetCassandraConn(pHeaders, 'dev_cas', function (pClient) {
        casssandraConn.dev_cas = pClient;
        devCasLoaded = true;
        successCall();
    });
    reqCassandraInstance.GetCassandraConn(pHeaders, 'dep_cas', function (pClient) {
        casssandraConn.dep_cas = pClient;
        depCasLoaded = true;
        successCall();
    });
    reqCassandraInstance.GetCassandraConn(pHeaders, 'log_cas', function (pClient) {
        casssandraConn.log_cas = pClient;
        logCasLoaded = true;
        successCall();
    });
    reqCassandraInstance.GetCassandraConn(pHeaders, 'res_cas', function (pClient) {
        casssandraConn.res_cas = pClient;
        resCasLoaded = true;
        successCall();
    });
    // reqCassandraInstance.GetCassandraConn(pHeaders, 'plt_cas', function (pClient) {
       // casssandraConn.plt_cas = pClient;
       // pltCasLoaded = true;
        // successCall();
    // });
    function successCall() {
        if (cltCasLoaded && devCasLoaded && depCasLoaded && logCasLoaded && resCasLoaded) {
            return callback('SUCCESS');
        }
    }
}

// this will start delete process
function deleteWithGivenParams(pHeaders, pParams, callback) {
    var selectQueries = selectQueriesJSON;
    var deleteQueries = deleteQueriesJSON;
    var deleteAppQueries = deleteAppQueriesJSON;
    var deleteAppTenantLink = deleteAppTenantLinkJSON;
    var deleteTenantQueries = deleteTenantQueriesJSON;
    var deleteClientQueries = deleteClientQueriesJSON;
    var conditionValues = pParams;
    const SEL_APP_TENANTS_COUNT = "SELECT count(*) FROM APP_TENANTS WHERE APP_ID = ? AND TENANT_ID = ?";
    getAllCassandraConn(pHeaders, function (result) {
        doProcess();
    });
    function doProcess() {
        var Q = q.defer();
        co(function* () {
            var cassandraKeys = Object.keys(selectQueries);
            for (var a = 0; a < cassandraKeys.length; a++) {
                var keyspace = cassandraKeys[a];
                var queries = selectQueries[keyspace];
                var casClient = casssandraConn[keyspace];
                if (cassandraKeys[a] == 'requires') {
                    casClient = casssandraConn['clt_cas'];
                    yield selectValues(casClient, queries);
                } else {
                    if (typeof conditionValues.TENANT_ID == 'string' && conditionValues.TENANT_ID && conditionValues.TENANT_ID != '0') {
                        yield selectValues(casClient, queries);
                        if (a == (cassandraKeys.length - 1)) {
                            isDeleteTenant = true;
                            yield deleteValues();
                            yield done();
                        }
                    } else if (typeof conditionValues.APP_ID == 'string' && conditionValues.APP_ID && conditionValues.APP_ID != '0') {
                        yield selectValues(casClient, queries);
                        if (a == (cassandraKeys.length - 1)) {
                            isDeleteTenant = true;
                            isDeleteApp = true;
                            yield deleteValues();
                            yield done();
                        }
                    } else {
                        yield selectValues(casClient, queries);
                        if (a == (cassandraKeys.length - 1)) {
                            isDeleteTenant = true;
                            isDeleteApp = true;
                            isDeleteClient = true;
                            yield deleteValues();
                            yield done();
                        }
                    }
                }
            }
            function* done() {
                Q.resolve(callback('SUCCESS'));
            }
        }).catch(function (error) {
            Q.reject(callback(error));
        });
        return Q.promise;
    }

    function* selectValues(pClient, pQueries) {
        var i = 0;
        function* doSelect(queryDetails) {
            i++;
            var query = queryDetails.query;
            var arrToConvert = getConditionParams(queryDetails.params, conditionValues);
            var restrict = queryDetails.restrict;
            if (!conditionValues[restrict] || conditionValues[restrict] == '0') {
                var count = 0;
                var tmpArr = [];
                function* formConditionArray(arr, cb1) {
                    var index = count;
                    count++;
                    function* next() {
                        if (count == arrToConvert.length) {
                            yield cb1(tmpArr);
                        } else {
                            yield formConditionArray(arrToConvert[count], cb1);
                        }
                    }
                    if (arr) {
                        if (typeof arr == 'string') {
                            tmpArr[index] = arr;
                            yield next();
                        } else {
                            for (var i = 0; i < arr.length; i++) {
                                var val = arr[i];
                                tmpArr[index] = val;
                                if (index < (count - 1)) {
                                    count = index + 1;
                                }
                                yield next();
                            }
                        }
                    } else if (count < arrToConvert.length) {
                        yield formConditionArray(arrToConvert[count], cb1);
                    }
                }
                yield formConditionArray(arrToConvert[count], function* (condition) {
                    //execute select query here
                    var result = yield executecassandra(pClient, query, condition, true);
                    if (result) {
                        var resultArr = result.rows;
                        for (var j = 0; j < resultArr.length; j++) {
                            var row = resultArr[j];
                            var rowKeys = Object.keys(row);
                            for (var k = 0; k < rowKeys.length; k++) {
                                var key = rowKeys[k];
                                if (key.toUpperCase() in conditionValues) {
                                    var arr = [];
                                    if (typeof conditionValues[key.toUpperCase()] == 'string') {
                                        if (conditionValues[key.toUpperCase()] && conditionValues[key.toUpperCase()] != '0' && conditionValues[key.toUpperCase()] != row[key]) {
                                            arr.push(conditionValues[key.toUpperCase()]);
                                            arr.push(row[key]);
                                            conditionValues[key.toUpperCase()] = arr;
                                        } else {
                                            arr.push(row[key]);
                                            conditionValues[key.toUpperCase()] = arr;
                                        }
                                    } else {
                                        arr = conditionValues[key.toUpperCase()];
                                        if (arr.indexOf(row[key], 0) == -1) {
                                            arr.push(row[key]);
                                        }
                                        conditionValues[key.toUpperCase()] = arr;
                                    }
                                } else {
                                    conditionValues[key.toUpperCase()] = [row[key]];
                                }
                            }
                        }
                        if (i < pQueries.length) {
                            yield doSelect(pQueries[i]);
                        }
                    } else {
                        console.log(query, condition, '-----No Result');
                    }
                });
            } else {
                if (i < pQueries.length) {
                    yield doSelect(pQueries[i]);
                }
            }
        }
        yield doSelect(pQueries[i]);
    }

    function deleteValues() {
        var Q = q.defer();
        co(function* () {
            yield doDelete(deleteQueries);
            if (isDeleteTenant) {
                yield doDelete(deleteAppTenantLink);
                if (isDeleteClient) {
                    yield doDelete(deleteTenantQueries);
                } else {
                    var tenantIds = conditionValues.TENANT_ID;
                    for (var i = 0; i < tenantIds.length; i++) {
                        var tenantId = tenantIds[i];
                        var result = yield executecassandra(casssandraConn['clt_cas'], SEL_APP_TENANTS_COUNT, [conditionValues.APP_ID, tenantId], true);
                        var tenantLinkCount = parseInt(result.rows[0].count);
                        if (tenantLinkCount && conditionValues.TENANT_ID.indexOf(tenantId, 0) != -1) {
                            conditionValues.TENANT_ID.splice(conditionValues.TENANT_ID.indexOf(tenantId, 0), 1);
                        }
                    }
                    yield doDelete(deleteTenantQueries);
                }
            }
            if (isDeleteApp) {
                yield doDelete(deleteAppQueries);
            }
            if (isDeleteClient) {
                yield doDelete(deleteClientQueries);
            }
            Q.resolve('SUCCESS');
        }).catch(function (error) {
            Q.reject(error);
        });
        return Q.promise;
    }
    function* doDelete(queryDetails) {
        var cassandraKeys = Object.keys(queryDetails);
        for (var a = 0; a < cassandraKeys.length; a++) {
            var keyspace = cassandraKeys[a];
            var queries = queryDetails[keyspace];
            var casClient = casssandraConn[keyspace];
            for (var i = 0; i < queries.length; i++) {
                var query = queries[i].query;
                var arrToConvert = getConditionParams(queries[i].params, conditionValues);
                var count = 0;
                var tmpArr = [];
                function* formConditionArray(arr, callback) {
                    var index = count;
                    count++;
                    function* next() {
                        if (count == arrToConvert.length) {
                            yield callback(tmpArr);
                        } else {
                            yield formConditionArray(arrToConvert[count], callback);
                        }
                    }
                    if (typeof arr == 'string') {
                        tmpArr[index] = arr;
                        yield next();
                    } else {
                        if (arr) {
                            for (var i = 0; i < arr.length; i++) {
                                var val = arr[i];
                                tmpArr[index] = val;
                                if (index < (count - 1)) {
                                    count = index + 1;
                                }
                                yield next();
                            }
                        } else {
                            console.log(arr);
                            yield next();
                        }
                    }
                }
                yield formConditionArray(arrToConvert[count], function* cb(condition) {
                    //execute delete query here
                    console.log(query, condition);
                    yield executecassandra(casClient, query, condition, true);
                });
            }
        }
    }
}

// this will call after delete done
function successCall(callback) {
    console.log("Delete Done.");
    return callback('SUCCESS');
}

// this will call from router for initiate delete
function doDeleteExp(pParams, pHeader, callback) {
    if (pParams.CLIENT_ID && pParams.CLIENT_ID != '0') {
        deleteWithGivenParams(pHeader, pParams, function (result) {
            successCall(callback);
        });
    } else {
        return callback('FAILURE')
    }
}

module.exports = {
    DoDelete: doDeleteExp
}