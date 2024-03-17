/*
 * @Decsription      : To create and maintain SolrInstance for producers and consumers
 * @Last Error Code  : 'ERR-SOLR-232060'
 */

// Require dependencies
//var config = require('../../config/config.json');
var reqSolr = require('solr-client');
var request = require('request');
var reqRedis = require('redis');
var reqInstanceHelper = require('../common/InstanceHelper');
var reqEncryptionInstance = require('../common/crypto/EncryptionInstance');
var Agent = require('agentkeepalive');

var mSolrSession = {};
var mSolrURLSession = {};
var defaultRoutingKey = 'clt-0~app-0~tnt-0~env-0';

var arrConnectedServers = [];
var serviceName = 'SolrInstance';

var connStringLog = 'SOLR_LOGGING';
var connStringSearch = 'SOLR_SEARCH';
var connStringLang = 'SOLR_LANGUAGE';
var connStringUser = 'SOLR_USERS';

var objLogInfo = null;

// Create solr search engine instance
function createSolrInstance(pRedisKey, pVal, pCallback) {
    try {
        // pVal.SERVER = '192.168.2.221';
        // pVal.SERVER = '192.168.2.220';
        // pVal.PORT = 32720;

        var objSolr = pVal;
        var server = objSolr.SERVER;
        var port = objSolr.PORT;
        var user = objSolr.USER;
        var password;
        if (objSolr.PASSWORD) {
            password = reqEncryptionInstance.DoDecrypt(objSolr.PASSWORD.toLowerCase());
            //  password = objSolr.PASSWORD;
        }
        var cores = objSolr.CORE;

        var keepaliveAgent = new Agent({
            maxSockets: 100,
            maxFreeSockets: 10,
            timeout: 60000,
            keepAliveTimeout: 3000 // free socket keepalive for 3 seconds 
        });

        var failureResult = {};
        failureResult.status = 'FAILURE';
        failureResult.sessionCount = null;
        // client connects to solr host
        var coreValues = mSolrSession[pRedisKey] ? mSolrSession[pRedisKey] : {}; // for maintain other solr valuse;
        var count = 0;
        var coreKeys = Object.keys(cores);
        connectSolr(coreKeys[count]);

        function connectSolr(coreKey) {
            try {
                count++;
                var solrClient = null;
                var conn = {
                    host: server,
                    port: port,
                    core: cores[coreKey],
                    agent: keepaliveAgent
                };
                var currentKey = '';
                for (var i = 0; i < arrConnectedServers.length; i++) {
                    var item = arrConnectedServers[i];
                    if (item.conn.agent) {
                        delete item.conn.agent; // this is not stringify so removed
                    }
                    if (conn.agent) {
                        delete conn.agent; // this is not stringify so removed
                    }
                    if (JSON.stringify(item.conn) == JSON.stringify(conn)) {
                        currentKey = item.keyName;
                        break;
                    }
                }
                var keyName = '';
                if (currentKey != '') {
                    //console.log('Solr Server Already Connected');
                    keyName = currentKey.split('@')[0];
                    coreValues[coreKey] = mSolrSession[keyName][coreKey];
                    if (count < coreKeys.length) {
                        connectSolr(coreKeys[count]);
                    } else {
                        solrClientCreated();
                    }
                } else {
                    //console.log('New Solr Server Connected');
                    solrClient = reqSolr.createClient(conn);
                    if (user && password) {
                        solrClient.basicAuth(user, password);
                    }
                    CheckSolrAvail(solrClient, function (error, result) {
                        keyName = pRedisKey + '@' + coreKey;
                        if (result == 'SUCCESS') {
                            pushConnectionToArray(keyName, conn);
                        }
                        coreValues[coreKey] = solrClient;
                        if (count < coreKeys.length) {
                            connectSolr(coreKeys[count]);
                        } else {
                            solrClientCreated();
                        }
                        /*      } else {
                                 reqInstanceHelper.PrintError(serviceName, 'FAILURE for ' + pRedisKey, '', null);
                                 reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232001', 'FAILURE for ' + pRedisKey, '');
                                 doConnect(pRedisKey);
                                 return pCallback(failureResult, error);
                             }*/
                    });
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232002', 'Error in createSolrInstance function', error);
                pCallback(failureResult, error);
            }

            function solrClientCreated() {
                try {
                    var isConnectedSolr = true;
                    var solrCoreKeys = Object.keys(coreValues);
                    for (let s = 0; s < solrCoreKeys.length; s++) {
                        const element = coreValues[solrCoreKeys[s]];
                        if (!element.IS_CONNECTED) {
                            isConnectedSolr = false;
                        }
                    }
                    if (isConnectedSolr) {
                        // Storing The Solr Connections In to the Memory 
                        mSolrSession[pRedisKey.toUpperCase()] = coreValues;
                    }
                    var result = {};
                    result.status = 'SUCCESS';
                    result.session = coreValues;
                    result.sessionCount = solrCoreKeys.length;
                    return pCallback(result, null);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232003', 'Error in createSolrInstance function', error);
                    pCallback(failureResult, null);
                }
            }
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232004', 'Error in createSolrInstance function', error);
        pCallback(failureResult, error);
    }
}

function createSolrURL(pRedisKey, pVal, pCallback) {
    try {
        var objSolr = pVal;
        var server = objSolr.SERVER;
        var port = objSolr.PORT;
        var cores = objSolr.CORE;
        // client connects to solr host
        var coreValues = mSolrURLSession[pRedisKey] ? mSolrURLSession[pRedisKey] : {}; // for maintain other solr valuse;
        Object.keys(cores).forEach(function (coreKey) {
            try {
                var solrClient = null;
                var conn = {
                    host: server,
                    port: port,
                    core: cores[coreKey]
                };
                var currentKey = '';
                var keyName = '';
                if (currentKey != '') {
                    //console.log('Solr Server Already Connected');
                    keyName = currentKey.split('@')[0];
                    coreValues[coreKey] = mSolrURLSession[keyName][coreKey];
                } else {
                    //console.log('New Solr Server Connected');
                    solrClient = 'http://' + conn.host + ':' + conn.port; //reqSolr.createClient(conn);
                    keyName = pRedisKey + '@' + coreKey;
                    //pushConnectionToArray(keyName, conn);
                    coreValues[coreKey] = solrClient;
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232005', 'Error in createSolrURL function', error);
            }
        });
        mSolrURLSession[pRedisKey.toUpperCase()] = coreValues;
        var result = {};
        result.status = 'SUCCESS';
        result.sessionCount = Object.keys(mSolrURLSession).length;
        return pCallback(result);
    } catch (error) {
        var failureResult = {};
        failureResult.status = 'FAILURE';
        failureResult.sessionCount = null;
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232006', 'Error in createSolrURL function', error);
        pCallback(failureResult);
    }
}

function createUrlOnRuntime(pRedisKey, callback) {
    try {
        var failureResult = {};
        failureResult.status = 'FAILURE';
        failureResult.sessionCount = null;
        reqInstanceHelper.GetConfig(pRedisKey, function (pConf) {
            try {
                var objResult = JSON.parse(pConf);
                createSolrURL(pRedisKey, objResult, function (pResult) {
                    try {
                        return callback(pResult);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232007', 'Error in createUrlOnRuntime function', error);
                        callback(failureResult);
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232008', 'Error in createUrlOnRuntime function', error);
                callback(failureResult);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232009', 'Error in createUrlOnRuntime function', error);
        callback(failureResult);
    }
}

function pushConnectionToArray(pKey, pConn) {
    try {
        var obj = {};
        obj.keyName = pKey;
        obj.conn = pConn;
        arrConnectedServers.push(obj);
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232010', 'Error in pushConnectionToArray function', error);
    }
}

function SolrDelete(pHeaders, pCore, pFiledName, pValues, pLogInfo, pCallback) {
    try {
        var getSolrConnectionAlias = getSolrSearchConn;
        if (pCore == 'LANGUAGE_CORE' || pCore == 'LANGUAGE_NAMESPACE_CORE') {
            getSolrConnectionAlias = getSolrLangConn;
        } else if (pCore == 'TRACE_LOG_CORE' || pCore == 'DEBUG_LOG') {
            getSolrConnectionAlias = getSolrLogConn;
        }
        getSolrConnectionAlias(pHeaders, pCore.toUpperCase(), function (client) {
            try {
                if (client) {
                    var count = 0;
                    if (!pValues.length) {
                        return pCallback('SUCCESS');
                    }
                    for (var i = 0; i < pValues.length; i++) {
                        var query = pFiledName + pValues[i].toString();
                        reqInstanceHelper.PrintInfo(serviceName, 'SolrDelete : ' + query, pLogInfo);
                        client.delete(pFiledName, pValues[i].toString(), function callbackSolrDelete(error, pResult) {
                            try {
                                if (error) {
                                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-SOLR-232011', 'Error in SolrDelete function', error);
                                }
                                count++;
                                if (count == pValues.length) {
                                    client.commit();
                                    return pCallback('SUCCESS');
                                }
                            } catch (error) {
                                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-SOLR-232012', 'Error in SolrDelete function', error);
                                pCallback('FAILURE');
                            }
                        });
                    }
                } else {
                    reqInstanceHelper.PrintInfo(serviceName, 'solr key not available. ', objLogInfo);
                    pCallback('FAILURE');
                }

            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-SOLR-232013', 'Error in SolrDelete function', error);
                pCallback('FAILURE');
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-SOLR-232014', 'Error in SolrDelete function', error);
        pCallback('FAILURE');
    }
}

function SolrAdd(pHeaders, pCore, pValues, pLogInfo, pCallback) {
    try {
        //var client = mSolrSession[pSolrCoreName.toLowerCase()]
        getSolrSearchConn(pHeaders, pCore.toUpperCase(), function (client) {
            try {
                var count = 0;
                //console.log("VALUE" + JSON.stringify(pValues));
                client.add(pValues, function (error, obj) {
                    try {
                        if (error) {
                            reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-SOLR-232015', 'Error in SolrAdd function', error);
                            pCallback();
                        } else {
                            //client.commit();
                            //console.log("SUCCESS" + JSON.stringify(obj));
                            pCallback(obj);
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-SOLR-232016', 'Error in SolrAdd function', error);
                        pCallback();
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-SOLR-232017', 'Error in SolrAdd function', error);
                pCallback();
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-SOLR-232018', 'Error in SolrAdd function', error);
        pCallback();
    }
}

function SolrUpdate(pHeaders, pCore, pValues, pLogInfo, pCallback) {
    try {
        //var client = mSolrSession[pSolrCoreName.toLowerCase()]
        getSolrLogConn(pHeaders, pCore, function (client) {
            // getSolrSearchConn(pHeaders, pCore.toUpperCase(), function (client) {
            try {
                var count = 0;
                //console.log("VALUE" + JSON.stringify(pValues));
                client.add(pValues, function (error, obj) {
                    try {
                        if (error) {
                            reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-SOLR-232015', 'Error in SolrAdd function', error);
                            pCallback();
                        } else {
                            //client.commit();
                            //console.log("SUCCESS" + JSON.stringify(obj));
                            pCallback(obj);
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-SOLR-232016', 'Error in SolrAdd function', error);
                        pCallback();
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-SOLR-232017', 'Error in SolrAdd function', error);
                pCallback();
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-SOLR-232018', 'Error in SolrAdd function', error);
        pCallback();
    }
}

function SolrInsert(pSolrSession, pValues, pLogInfo, pCallback) {
    try {
        var count = 0;
        //console.log("VALUE" + JSON.stringify(pValues));
        pSolrSession.add(pValues, function (error, pObj) {
            try {
                if (error) {
                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-SOLR-232019', 'Error in SolrInsert function', error);
                    pCallback(error, pObj);
                } else {
                    //console.log("SUCCESS" + JSON.stringify(pObj));
                    pCallback(error, pObj);
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-SOLR-232020', 'Error in SolrInsert function', error);
                pCallback(error, pObj);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-SOLR-232021', 'Error in SolrInsert function', error);
        pCallback(error, null);
    }
}

function Commit(pSolrSession, pBlnCommit) {
    try {
        if (pBlnCommit) {
            //pSolrSession.commit()
        } else {
            //pSolrSession.rollback()
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232022', 'Error in Commit function', error);
    }
}

function SolrSearch(pHeaders, pCore, pParamJson, pCallback) {
    try {
        //var client = mSolrSession[pSolrCoreName.toLowerCase()];
        getSolrSearchConn(pHeaders, pCore.toUpperCase(), function (client) {
            try {
                reqInstanceHelper.PrintInfo(serviceName, 'SolrSearch : ' + JSON.stringify(pParamJson), objLogInfo);
                var query = client.createQuery().q(pParamJson);
                client.search(query, function (error, obj) {
                    try {
                        if (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232023', 'Error in SolrSearch function', error);
                            pCallback();
                        } else {
                            //console.log(obj);
                            pCallback(obj);
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232024', 'Error in SolrSearch function', error);
                        pCallback();
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232025', 'Error in SolrSearch function', error);
                pCallback();
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232026', 'Error in SolrSearch function', error);
        pCallback();
    }
}

function SolrSearchWithPaging(pHeaders, pCore, pParamStr, pRecordPerPage, pCurrentPage, pCallback) {
    try {
        var solrSearchLogInfo = pHeaders.LOG_INFO ? pHeaders.LOG_INFO : null;
        var getSolrConnection = getSolrSearchConn;
        if (pCore == 'LANGUAGE_CORE' || pCore == 'LANGUAGE_NAMESPACE_CORE') {
            getSolrConnection = getSolrLangConn;
        }
        getSolrConnection(pHeaders, pCore.toUpperCase(), function (client) {
            try {
                var intOffSet = (pCurrentPage - 1) * pRecordPerPage;
                reqInstanceHelper.PrintInfo(serviceName, 'SolrSearchWithPaging : ' + pParamStr, solrSearchLogInfo);
                var query = client.createQuery().q(pParamStr).start(intOffSet).rows(pRecordPerPage);
                client.search(query, function (error, obj) {
                    try {
                        if (error) {
                            reqInstanceHelper.PrintError(serviceName, solrSearchLogInfo, 'ERR-SOLR-232027', 'Error in SolrSearchWithPaging function', error);
                            pCallback(error);
                        } else {
                            //console.log(obj);
                            pCallback(obj);
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, solrSearchLogInfo, 'ERR-SOLR-232028', 'Error in SolrSearchWithPaging function', error);
                        pCallback();
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, solrSearchLogInfo, 'ERR-SOLR-232029', 'Error in SolrSearchWithPaging function', error);
                pCallback();
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, solrSearchLogInfo, 'ERR-SOLR-232030', 'Error in SolrSearchWithPaging function', error);
        pCallback();
    }
}

function LogSolrSearchWithPaging(pHeaders, pCore, pParamStr, pRecordPerPage, pCurrentPage, pCallback, pSort, pGroupField, pStrSolrFields) {
    try { //var client = mSolrSession[pSolrCoreName.toLowerCase()];
        var solrLogSearchLogInfo = pHeaders.LOG_INFO ? pHeaders.LOG_INFO : null;
        getSolrLogConn(pHeaders, pCore.toUpperCase(), function (client) {
            try {
                reqInstanceHelper.PrintInfo(serviceName, 'LogSolrSearchWithPaging : ' + pParamStr, solrLogSearchLogInfo);
                var query = client.createQuery().q(pParamStr);
                try {
                    if (pStrSolrFields) {
                        // Expected Value "VERSION_NO,TRN_ID,PRCT_ID"
                        reqInstanceHelper.PrintInfo(serviceName, 'Solr Fields : ' + pStrSolrFields, solrLogSearchLogInfo);
                        query.fl(pStrSolrFields);
                    }
                } catch (error) { }

                if (pRecordPerPage) {
                    var intOffSet = (pCurrentPage - 1) * pRecordPerPage;
                    query.start(intOffSet).rows(pRecordPerPage);
                } else {
                    query.start(0).rows(9999);
                }
                //Trace Log_code need  sort order
                if (pCore.toUpperCase() == "TRACE_LOG_CORE" || pCore.toUpperCase() == "DEBUG_LOG") {
                    query.parameters.push("sort=STARTTIME+desc");
                } else if (pCore.toUpperCase() == "SCH_JOBS_LOG" || pCore.toUpperCase() == "SCH_JOBS_THREAD_LOG") {
                    query.parameters.push("sort=START_TIME+desc");
                }
                if (pSort) {
                    query.parameters.push(pSort);
                }
                if (pGroupField) {
                    query.parameters.push("group=true");
                    query.parameters.push("group.field=" + pGroupField);
                    query.parameters.push("group.format=simple");
                }
                client.search(query, function (error, obj) {
                    try {
                        if (error) {
                            pCallback(null, error);
                            reqInstanceHelper.PrintError(serviceName, solrLogSearchLogInfo, 'ERR-SOLR-232031', 'Error in LogSolrSearchWithPaging function', error);
                        } else {
                            // console.log(JSON.stringify(obj));
                            if (obj && obj.response) {
                                reqInstanceHelper.PrintInfo(serviceName, 'Sol Docs Count | ' + obj.response.numFound, solrLogSearchLogInfo);
                            }
                            pCallback(obj);
                            //console.log(JSON.stringify(obj));
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, solrLogSearchLogInfo, 'ERR-SOLR-232032', 'Error in LogSolrSearchWithPaging function', error);
                        pCallback(null, error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, solrLogSearchLogInfo, 'ERR-SOLR-232033', 'Error in LogSolrSearchWithPaging function', error);
                pCallback(null, error);
            }
        });
    } catch (ex) {
        reqInstanceHelper.PrintError(serviceName, solrLogSearchLogInfo, 'ERR-SOLR-232034', 'Error in LogSolrSearchWithPaging function', error);
        pCallback(null, error);
    }
}

function createInstancesOnRuntime(pRedisKey, callback) {
    try {
        var failureResult = {};
        failureResult.status = 'FAILURE';
        failureResult.sessionCount = null;
        reqInstanceHelper.GetConfig(pRedisKey, function (pConf) {
            try {
                if (pConf) {
                    var objResult = JSON.parse(pConf);
                    createSolrInstance(pRedisKey, objResult, function (pResult, pError) {
                        try {
                            return callback(pResult, pError);
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232035', 'Error in createInstancesOnRuntime function', error);
                            callback(failureResult, error);
                        }
                    });
                } else {
                    callback(failureResult, pRedisKey + "Key not found");
                }

            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232036', 'Error in createInstancesOnRuntime function', error);
                callback(failureResult, error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232037', 'Error in createInstancesOnRuntime function', error);
        callback(failureResult, error);
    }
}

function getSolrLogConn(pHeaders, pCore, callback) {
    getSolrConnection(pHeaders, connStringLog, pCore, callback);
}

function getSolrSearchConn(pHeaders, pCore, callback) {
    getSolrConnection(pHeaders, connStringSearch, pCore, callback);
}

function getSolrUserConn(pHeaders, pCore, callback) {
    getSolrConnection(pHeaders, connStringUser, pCore, callback);
}

function getSolrLangConn(pHeaders, pCore, callback) {
    getSolrConnection(pHeaders, connStringLang, pCore, callback);
}

function getSolrConnection(pHeaders, connString, pCore, callback) {
    try {
        if (!pHeaders) {
            pHeaders = {};
        }
        var solrConnLogInfo = pHeaders.LOG_INFO ? pHeaders.LOG_INFO : null;
        reqInstanceHelper.PrintInfo(serviceName, 'GetSolrConnection Start | ' + pCore, solrConnLogInfo);
        var solr = null;
        reqInstanceHelper.PrintInfo(serviceName, 'routingkey ==== ' + pHeaders['routingkey'], solrConnLogInfo);
        reqInstanceHelper.GetRedisKey(connString, pHeaders['routingkey'], function (redisKey) {
            try {
                reqInstanceHelper.PrintInfo(serviceName, 'Finding redisKey ==== ' + redisKey, solrConnLogInfo);
                reqInstanceHelper.IsRedisKeyAvail(redisKey, function (result) {
                    try {
                        var coreValues;
                        if (result) {
                            if (mSolrSession[redisKey.toUpperCase()]) {
                                reqInstanceHelper.PrintInfo(serviceName, 'Solr available', solrConnLogInfo);
                                coreValues = mSolrSession[redisKey.toUpperCase()];
                                solr = coreValues[pCore];
                                return sendResult(solr);
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'New Solr creation', solrConnLogInfo);
                                createInstancesOnRuntime(redisKey, function (pResult) {
                                    try {
                                        if (pResult.status == 'SUCCESS') {
                                            coreValues = pResult.session;
                                            solr = coreValues[pCore];
                                            return sendResult(solr);
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.PrintError(serviceName, solrConnLogInfo, 'ERR-SOLR-232038', 'Error in getSolrConnection function', error);
                                        return sendResult(null);
                                    }
                                });
                            }
                        } else {
                            reqInstanceHelper.PrintInfo(serviceName, 'Accessing default Solr', solrConnLogInfo);
                            var defaultRedisKey = (connString + '~' + defaultRoutingKey).toUpperCase();
                            coreValues = mSolrSession[defaultRedisKey.toUpperCase()];
                            if (coreValues) {
                                reqInstanceHelper.PrintInfo(serviceName, 'Default Solr available', solrConnLogInfo);
                                solr = coreValues[pCore];
                                return sendResult(solr);
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'Connecting default Solr', solrConnLogInfo);
                                createInstancesOnRuntime(defaultRedisKey, function (pResult, pError) {
                                    try {
                                        if (pResult.status == 'SUCCESS') {
                                            coreValues = mSolrSession[defaultRedisKey.toUpperCase()];
                                            solr = coreValues[pCore];
                                            return sendResult(solr);
                                        } else {
                                            return sendResult(null, pError);
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.PrintError(serviceName, solrConnLogInfo, 'ERR-SOLR-232039', 'Error in getSolrConnection function', error);
                                        return sendResult(null, error);
                                    }
                                });
                            }
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, solrConnLogInfo, 'ERR-SOLR-232040', 'Error in getSolrConnection function', error);
                        return sendResult(null, error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, solrConnLogInfo, 'ERR-SOLR-232041', 'Error in getSolrConnection function', error);
                return sendResult(null, error);
            }
        });
        function sendResult(result, pError) {
            reqInstanceHelper.PrintInfo(serviceName, 'GetSolrConnection End | ' + pCore, solrConnLogInfo);
            return callback(result, pError);
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, solrConnLogInfo, 'ERR-SOLR-232042', 'Error in getSolrConnection function', error);
        return sendResult(null, error);
    }
}

function getSolrURL(pHeaders, pCore, callback) {
    try {
        var solrUrlLogInfo = pHeaders.LOG_INFO ? pHeaders.LOG_INFO : null;
        var solr = null;
        reqInstanceHelper.PrintInfo(serviceName, 'routingkey ==== ' + pHeaders['routingkey'], solrUrlLogInfo);
        reqInstanceHelper.GetRedisKey(connStringSearch, pHeaders['routingkey'], function (redisKey) {
            try {
                reqInstanceHelper.PrintInfo(serviceName, 'Finding redisKey ==== ' + redisKey, solrUrlLogInfo);
                reqInstanceHelper.IsRedisKeyAvail(redisKey, function (result) {
                    try {
                        var coreValues;
                        if (result) {
                            if (mSolrURLSession[redisKey.toUpperCase()]) {
                                reqInstanceHelper.PrintInfo(serviceName, 'Solr key available', solrUrlLogInfo);
                                coreValues = mSolrURLSession[redisKey.toUpperCase()];
                                solr = coreValues[pCore];
                                return callback(solr);
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'New Solr creation', solrUrlLogInfo);
                                createUrlOnRuntime(redisKey, function (pResult) {
                                    try {
                                        if (pResult.status == 'SUCCESS') {
                                            coreValues = mSolrURLSession[redisKey.toUpperCase()];
                                            solr = coreValues[pCore];
                                            return callback(solr);
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.PrintError(serviceName, solrUrlLogInfo, 'ERR-SOLR-232043', 'Error in getSolrURL function', error);
                                        callback(solr);
                                    }
                                });
                            }
                        } else {
                            reqInstanceHelper.PrintInfo(serviceName, 'Accessing default Solr', solrUrlLogInfo);
                            var defaultRedisKey = (connStringSearch + '~' + defaultRoutingKey).toUpperCase();
                            coreValues = mSolrURLSession[defaultRedisKey.toUpperCase()];
                            if (coreValues) {
                                solr = coreValues[pCore];
                                return callback(solr);
                            } else {
                                reqInstanceHelper.PrintInfo(serviceName, 'Connecting default Solr', solrUrlLogInfo);
                                createUrlOnRuntime(defaultRedisKey, function (pResult) {
                                    try {
                                        if (pResult.status == 'SUCCESS') {
                                            coreValues = mSolrURLSession[defaultRedisKey.toUpperCase()];
                                            solr = coreValues[pCore];
                                            return callback(solr);
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.PrintError(serviceName, solrUrlLogInfo, 'ERR-SOLR-232044', 'Error in getSolrURL function', error);
                                        callback(solr);
                                    }
                                });
                            }
                        }
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, solrUrlLogInfo, 'ERR-SOLR-232045', 'Error in getSolrURL function', error);
                        callback(solr);
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, solrUrlLogInfo, 'ERR-SOLR-232046', 'Error in getSolrURL function', error);
                callback(solr);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, solrUrlLogInfo, 'ERR-SOLR-232047', 'Error in getSolrURL function', error);
        callback(solr);
    }
}

var arrDoConnect = [];
var arrRetryingKeys = [];

function doConnect(redisKey) { //not in use in this class
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
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232048', 'Error in doConnect function', error);
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
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232049', 'Error in doConnect function', error);
    }
}

function checkAllSolrAvail(callback) {
    try {
        var i = 0;
        var returnStr = 'SUCCESS';
        if (arrConnectedServers.length) {
            check(arrConnectedServers[i].keyName);

            function check(currentKey) {
                try {
                    i++;
                    var redisKey = currentKey.split('@')[0];
                    var coreKey = currentKey.split('@')[1];
                    var connString = redisKey.split('~')[0];
                    var routingkey = redisKey.replace(connString + '~', '');
                    var headers = {
                        routingkey: routingkey
                    };
                    switch (connString) {
                        case connStringLang:
                            getSolrLangConn(headers, coreKey, function (client) {
                                try {
                                    CheckSolrAvail(client, function (result) {
                                        try {
                                            if (result == 'SUCCESS') {
                                                reqInstanceHelper.PrintInfo(serviceName, connStringLang + ' ' + coreKey + ' in connected state', null);
                                            } else {
                                                reqInstanceHelper.PrintInfo(serviceName, connStringLang + ' ' + coreKey + ' not connected', null);
                                                returnStr = result;
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
                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232050', 'Error in checkAllSolrAvail function', error);
                                            return callback('FAILURE');
                                        }
                                    });
                                } catch (error) {
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232051', 'Error in checkAllSolrAvail function', error);
                                    return callback('FAILURE');
                                }
                            });
                            break;
                        case connStringLog:
                            getSolrLogConn(headers, coreKey, function (client) {
                                try {
                                    CheckSolrAvail(client, function (result) {
                                        try {
                                            if (result == 'SUCCESS') {
                                                reqInstanceHelper.PrintInfo(serviceName, connStringLog + ' ' + coreKey + ' in connected state', null);
                                            } else {
                                                reqInstanceHelper.PrintInfo(serviceName, connStringLog + ' ' + coreKey + ' not connected', null);
                                                returnStr = result;
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
                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232052', 'Error in checkAllSolrAvail function', error);
                                            return callback('FAILURE');
                                        }
                                    });
                                } catch (error) {
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232053', 'Error in checkAllSolrAvail function', error);
                                    return callback('FAILURE');
                                }
                            });
                            break;
                        case connStringSearch:
                            getSolrSearchConn(headers, coreKey, function (client) {
                                try {
                                    CheckSolrAvail(client, function (result) {
                                        try {
                                            if (result == 'SUCCESS') {
                                                reqInstanceHelper.PrintInfo(serviceName, connStringSearch + ' ' + coreKey + ' in connected state', null);
                                            } else {
                                                reqInstanceHelper.PrintInfo(serviceName, connStringSearch + ' ' + coreKey + ' not connected', null);
                                                returnStr = result;
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
                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232054', 'Error in checkAllSolrAvail function', error);
                                            return callback('FAILURE');
                                        }
                                    });
                                } catch (error) {
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232055', 'Error in checkAllSolrAvail function', error);
                                    return callback('FAILURE');
                                }
                            });
                            break;
                    }
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232056', 'Error in checkAllSolrAvail function', error);
                    return callback('FAILURE');
                }
            }
        } else {
            if (arrRetryingKeys.length == 0) {
                callback('SUCCESS');
            } else {
                callback('FAILURE');
            }
        }
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232057', 'Error in checkAllSolrAvail function', error);
        callback('FAILURE');
    }
}

function CheckSolrAvail(client, callback) {
    try {
        client.ping(function (error, result) {
            try {
                if (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232058', 'Error in CheckSolrAvail function', error);
                    client.IS_CONNECTED = false;
                    return callback(error, 'FAILURE');
                } else {
                    client.IS_CONNECTED = true;
                    return callback(error, 'SUCCESS');
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232059', 'Error in CheckSolrAvail function', error);
                return callback(error, 'FAILURE');
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-SOLR-232060', 'Error in CheckSolrAvail function', error);
        return callback(error, 'FAILURE');
    }
}

function Disconnect(callback) {
    mSolrSession = {};
    mSolrURLSession = {};
    arrConnectedServers = [];
    return callback();
}

function getSchemaInfo(pHeaders, pCore, pObjLogInfo, callback) {
    try {
        var getSolrConnection = getSolrSearchConn;
        if (pCore == 'LANGUAGE_CORE' || pCore == 'LANGUAGE_NAMESPACE_CORE') {
            getSolrConnection = getSolrLangConn;
        }
        getSolrConnection(pHeaders, pCore, function (solrSession) {
            try {
                if (solrSession) {
                    var solrLangUrl = 'http://' + solrSession.options.host + ':' + solrSession.options.port + solrSession.options.path + '/' + solrSession.options.core + '/schema';
                    var options = {
                        url: solrLangUrl,
                        method: 'GET'
                    };
                    request(options, function (error, urlResp, urlResult) {
                        try {
                            if (error) {
                                return callback(error, null);
                            } else {
                                var schema = JSON.parse(urlResult).schema;
                                return callback(null, schema);
                            }
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, pObjLogInfo, 'errcode', 'errmsg', error);
                            return callback(error, null);
                        }
                    });
                } else {
                    return callback(solrSession);
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, pObjLogInfo, 'errcode', 'errmsg', error);
                return callback(error, null);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, pObjLogInfo, 'errcode', 'errmsg', error);
        return callback(error, null);
    }
}

module.exports = {
    CreateSolrInstance: createSolrInstance,
    SolrDelete: SolrDelete,
    SolrSearch: SolrSearch,
    SolrAdd: SolrAdd,
    SolrUpdate: SolrUpdate,
    SolrInsert: SolrInsert,
    Commit: Commit,
    SolrSearchWithPaging: SolrSearchWithPaging,
    GetSolrLogConn: getSolrLogConn,
    GetSolrSearchConn: getSolrSearchConn,
    GetSolrLangConn: getSolrLangConn,
    CreateSolrURL: createSolrURL,
    GetSolrURL: getSolrURL,
    CheckAllSolrAvail: checkAllSolrAvail,
    LogSolrSearchWithPaging: LogSolrSearchWithPaging,
    getSolrUserConn: getSolrUserConn,
    Disconnect: Disconnect,
    GetSchemaInfo: getSchemaInfo
};
/********* End of File **************/