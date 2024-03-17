// Require dependencies
var modPath = '../../../../node_modules/'
var express = require(modPath + 'express');
var reqTranDBInstance = require('../../../../torus-references/instance/AnalyticInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper')

// Initialize Global variables
var strResult = '';
var strMessage = '';

var router = express.Router();

var redisInstance = require('../../../../torus-references/instance/RedisInstance.js');


var serviceName = "Analytics Third Party Integration"

var request = require(modPath + 'request');

// Host the login api
router.post('/syncmetabasequestions', function (appReq, appResp) {

    var body = appReq.body;
    var mHeaders = appReq.headers;

    var process = body.process || '';
    var url = "";
    var payload = {};
    var requestMethod = "POST";
    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {

        getMetabaseURL().then((urlResp) => {

            request.get({
                "url": urlResp + "/api/activity/recent_views",
                "headers": {
                    "X-Metabase-Session": body.sessionid
                },
                json: true
            }, function (err, httpResponse, respbody) {
                if (err) {
                    sendErrorResponse("Third Party API URL Calling Failed", err)
                } else {
                    if (respbody.length > 0) {
                        var dataFromActivity = []
                        for (var dat of respbody) {
                            if (dat['model'] === 'card') {
                                dataFromActivity.push({
                                    "project_id": body.project_id,
                                    "question_id": dat['model_id'],
                                    "question_description": dat.model_object.name,
                                    "question_created_on": dat.max_ts,
                                    "user_id": objLogInfo.USER_ID
                                })
                            }
                        }

                        var arrData = [];
                        reqTranDBInstance.GetTranDBConn(mHeaders, false, function (tran_db_instance) {
                            var query = "select * from user_metabase_questions";

                            reqTranDBInstance.ExecuteSQLQuery(tran_db_instance, query, objLogInfo, function (result, error) {
                                if (error) {
                                    asyncCallbackFor();
                                } else {
                                    if (result.rows.length > 0) {
                                        var existingData = result.rows;

                                        var onlyInNew = dataFromActivity.filter(comparer(existingData));

                                        if (onlyInNew.length > 0) {
                                            reqTranDBInstance.InsertTranDBWithAudit(tran_db_instance, "user_metabase_questions", onlyInNew, objLogInfo, function (result, error) {
                                                sendSuccessResponse("Sync Success");
                                            })
                                        } else {
                                            sendSuccessResponse("Sync Success");
                                        }

                                    } else {
                                        reqTranDBInstance.InsertTranDBWithAudit(tran_db_instance, "user_metabase_questions", dataFromActivity, objLogInfo, function (result, error) {
                                            sendSuccessResponse("Sync Success");
                                        })
                                    }

                                }
                            })
                        });
                    } else {
                        sendSuccessResponse("Sync Success");
                    }
                }
            })
        }).catch((error) => {
            sendErrorResponse("Error While Invoking getMetabaseURL method", error)
        })


        function comparer(otherArray) {
            return function (current) {
                return otherArray.filter(function (other) {
                    return other.question_id.toString() == current.question_id.toString()
                }).length == 0;
            }
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


        function sendSuccessResponse(data) {
            reqInstanceHelper.SendResponse(serviceName, appResp, data, objLogInfo, '', '', '', "SUCCESS");
        }

        function sendErrorResponse(message, error) {
            reqInstanceHelper.SendResponse(serviceName, appResp, null, objLogInfo, '', message, error);
        }

    })
})
module.exports = router;