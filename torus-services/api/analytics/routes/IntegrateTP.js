// Require dependencies
var modPath = '../../../../node_modules/'
var express = require(modPath + 'express');
var reqTranDBInstance = require('../../../../torus-references/instance/AnalyticInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper')
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');

// Initialize Global variables
var strResult = '';
var strMessage = '';

var router = express.Router();

var redisInstance = require('../../../../torus-references/instance/RedisInstance.js');


var serviceName = "Analytics Third Party Integration"

var request = require(modPath + 'request');

// Host the login api
router.post('/IntegrateTP', function (appReq, appResp) {


    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {

        var body = '';
        var process = '';

        try {
            body = appReq.body.PARAMS || appReq.body;

            process = body.process || '';
        }
        catch (ex) {

        }





        if (process == "") {
            sendErrorResponse("Process is not defined", "")
        } else {
            getMetabaseURL().then((urlResp) => {
                var url = "";
                var payload = {};
                var requestMethod = "POST";

                if (process == "fetchurl") {
                    sendSuccessResponse(urlResp);
                } else {
                    switch (process) {
                        case "login":
                            url = urlResp + "/api/session";
                            payload.username = body.username.trim().toLowerCase();
                            payload.password = "Admin@100";
                            requestMethod = "POST";
                            break;
                        case "Logout":
                            url = urlResp + "/api/session";
                            requestMethod = "DELETE";
                            break;
                        case "fetchUserDetail":
                            url = urlResp + "/api/user/current";
                            payload.sessionid = body.sessionid;
                            requestMethod = "GET";
                            break;
                        case "syncMetaBaseQuestions":
                            url = urlResp + "/api/activity/recent_views";
                            payload.sessiodid = body.sessionid;
                            payload.userid = body.userid;
                            requestMethod = "GET";
                            break
                        case "addUser":
                            url = urlResp + "/api/user/";
                            payload.sessionid = body.sessionid;
                            payload.first_name = body.first_name;
                            payload.last_name = body.last_name;
                            payload.email = body.email.trim().toLowerCase();
                            payload.password = "Admin@100";
                            payload.login_name = body.login_name;
                            payload.client_id = body.client_id;
                            payload.u_id = body.user_id;
                            payload.group_ids = body.groupId;
                            requestMethod = "POST"
                        case "deleteUser":
                            break;
                        default:
                            break;
                    }


                    if (url == "") {
                        sendErrorResponse("Third Party API URL is not defined", "")
                    } else {
                        if (requestMethod == "POST") {
                            request.post({
                                "url": url,
                                "body": payload,
                                "headers": {
                                    "X-Metabase-Session": payload.sessionid
                                },
                                json: true
                            }, function (err, httpResponse, body) {
                                if (err) {
                                    sendErrorResponse("Third Party API URL Calling Failed", err)
                                } else {

                                    if (process == "addUser") {
                                        reqFXDBInstance.GetFXDBConnection(appReq.headers, 'clt_cas', objLogInfo, function (pCltClient) {
                                            reqFXDBInstance.UpdateFXDB(pCltClient, 'users', {
                                                'has_analytics': "Y"
                                            }, {
                                                'login_name': payload.login_name,
                                                'client_id': payload.client_id,
                                                'u_id': payload.USER_ID
                                            }, objLogInfo, function (Error, Result) {
                                                sendSuccessResponse(body);
                                            })

                                        })
                                    }
                                    else {
                                        sendSuccessResponse(body);
                                    }

                                }
                            })
                        } else if (requestMethod == "DELETE") {
                            request.del({
                                "url": url,
                                "headers": {
                                    "X-Metabase-Session": payload.sessionid
                                },
                                json: true
                            }, function (err, httpResponse, body) {
                                if (err) {
                                    sendErrorResponse("Third Party API URL Calling Failed", err)
                                } else {
                                    sendSuccessResponse(body);
                                }
                            })
                        } else {
                            request.get({
                                "url": url,
                                "headers": {
                                    "X-Metabase-Session": payload.sessionid
                                },
                                json: true
                            }, function (err, httpResponse, body) {
                                if (err) {
                                    sendErrorResponse("Third Party API URL Calling Failed", err)
                                } else {
                                    sendSuccessResponse(body);
                                }
                            })
                        }
                    }
                }
            }).catch((error) => {
                sendErrorResponse("Error While Invoking getMetabaseURL method", error)
            })
        }


        function getMetabaseURL() {
            return new Promise((resolve, reject) => {
                redisInstance.GetRedisConnection(function (error, clientR) {
                    if (error) {
                        reject(error);
                    } else {
                        var redis_key_name = "ANALYTICS_TP"
                        try {
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

                        } catch (ex) {
                            reject("")
                        }
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