/****
 * Api_Name          : /Upload,
 * Description       : ,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var modPath = '../../../../node_modules/'
var express = require(modPath + 'express');
var reqTranDBInstance = require('../../../../torus-references/instance/AnalyticInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var redisInstance = require('../../../../torus-references/instance/RedisInstance.js');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var async = require(modPath + 'async');
var redisInstance = require('../../../../torus-references/instance/RedisInstance.js');
var request = require(modPath+'request');
// Initialize Global variables

var strResult = '';
var strMessage = '';

var router = express.Router();
var strHeader = {};
var strHeader1 = {};

// Host the login api
router.post('/syncmetabase', function (appReq, appResp) {
    strHeader1 = {
        'routingkey': 'METABASE'
    }
    if (appReq.headers && appReq.headers.routingkey) {
        strHeader = appReq.headers;
    } else {
        strHeader = {
            'routingkey': 'CLT-0~APP-0~TNT-0~ENV-0'
        }
    }


    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
        reqLogWriter.Eventinsert(objLogInfo);
        objLogInfo.PROCESS = 'syncmetabase-Analytics';
        objLogInfo.ACTION = 'syncmetabase';

        try {

            reqTranDBInstance.GetTranDBConn(strHeader1, false, function callbackGetTranDB(pSession) {

                reqTranDBInstance.ExecuteSQLQuery(pSession, "select  * from metabase_database", objLogInfo, function (pResult, pError) {
                    if (pError) {
                        console.log(pError)
                        _SendResponse({}, 'Errcode', 'Cannot get metabase database details', pError, null);
                    } else {


                        getMetabaseURL().then((response) => {

                            var arr = [];
                            for (var rows of pResult.rows) {
                                var formedSyncSchemaURL = response + "/api/database/" + rows['id'] + "/sync_schema";
                                var formedSyncURL = response + "/api/database/" + rows['id'] + "/sync";

                                arr.push(formedSyncSchemaURL)

                                arr.push(formedSyncURL)
                            }

                            async.forEachOf(arr, function (value, key, asyncCallBackFor) {
                                request.post({
                                    "url": value,
                                    "headers": {
                                        "X-Metabase-Session": appReq.body.metabaseSession
                                    },
                                    json: true
                                }, function (err, httpResponse, body) {
                                    asyncCallBackFor();
                                })
                            }, function (err) {
                                _SendResponse({}, '', '', '', null);
                            })

                        }).catch((error) => {
                            _SendResponse({}, 'Errcode', 'Error While Fetching Metabase URL', error, null);
                        })
                    }
                })
            })
        } catch (error) {
            errorHandler("ERR-FX-10021", "Error APLogin function ERR-001 " + error)
        }

        function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
            var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
            var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
            return reqInstanceHelper.SendResponse('ChangeSearchTag', appResp, ResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
        }

        function errorHandler(errcode, message) {
            console.log(errcode, message);
            reqLogWriter.TraceError(objLogInfo, message, errcode);
        }

        function getMetabaseURL() {
            return new Promise((resolve, reject) => {
                redisInstance.GetRedisConnection(function (error, clientR) {
                    if (error) {
                        reject(error);
                    } else {
                        var redis_key_name = "ANALYTICS_TP"
                        clientR.get(redis_key_name, function (err, object) {
                            if (err) {
                                reject(err)
                            } else {
                                if (object != undefined) {
                                    object = JSON.parse(object);
                                    var urlResp = "";
                                    for (var obj of object) {
                                        if (obj['SERVICE_NAME'] === "METABASE") {
                                            urlResp = obj['SERVICE_PROPERTIES']["URL"];
                                        }
                                    }
                                    resolve(urlResp);
                                } else {
                                    reject("")
                                }
                            }
                        })
                    }
                })
            })
        }
    });
})

module.exports = router;