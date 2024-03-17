/****
 * Api_Name          : /metabasequestions,
 * Description       : To get the metabase questions,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var modPath = '../../../../node_modules/'
var express = require(modPath + 'express');
var reqTranDBInstance = require('../../../../torus-references/instance/AnalyticInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var redisInstance = require('../../../../torus-references/instance/RedisInstance.js');
var request = require(modPath + 'request');
// Initialize Global variables

var strResult = '';
var strMessage = '';

var router = express.Router();

// Host the login api
// router.post('/metabasequestions', function (appReq, appResp) {

//   reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
//     reqLogWriter.Eventinsert(objLogInfo);
//     objLogInfo.PROCESS = 'metabasequestions-Analytics';
//     objLogInfo.ACTION = 'metabasequestions';
//     var strHeader = {};


//     strHeader = {
//       'routingkey': 'METABASE'
//     }


//     var query = "select * from report_card where tap_projectid=" + appReq.body.projectid + ";"

//     try {
//       reqTranDBInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {
//         reqTranDBInstance.ExecuteSQLQuery(pSession, query, objLogInfo, function callback(res, err) {
//           if (err) {
//             _SendResponse({}, 'ERR-ANL-111105', 'Error selecting from project_queries Table', err, null, objLogInfo);
//           } else {
//             _SendResponse(res.rows, '', '', null, null, objLogInfo);
//           }
//         })
//       })
//     } catch (error) {
//       errorHandler("ERR-ANL-111105", "Error in getting trandb function in datasourceconfig" + error)
//     }
//   });
//   // To send the app response
//   function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning, pobjLogInfo) {
//     var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
//     var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
//     return reqInstanceHelper.SendResponse('ChangeSearchTag', appResp, ResponseData, pobjLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
//   }

//   function errorHandler(errcode, message) {
//     console.log(errcode, message);
//     reqLogWriter.TraceError(objLogInfo, message, errcode);
//   }
// });


router.post('/metabasequestions', function (appReq, appResp) {
    var pServiceName = 'metabasequestions'
    reqLogInfo.AssignLogInfoDetail(appReq, async function (objLogInfo, objSessionInfo) {

        function _printInfo(msg, objLogInfo) {
            reqInstanceHelper.PrintInfo(pServiceName, msg, objLogInfo)
        }
        reqLogWriter.Eventinsert(objLogInfo);
        objLogInfo.PROCESS = 'metabasequestions-Analytics';
        objLogInfo.ACTION = 'metabasequestions';
        var strHeader = {};
        var body = appReq.body;

        _printInfo('metabasequestions api started ', objLogInfo)


        getMetabaseURL().then(async (urlResp) => {
            var userinfoapi = urlResp + '/api/user/current'
            var headers = {
                "X-Metabase-Session": body.sessionid
            }

            _printInfo('Getting current loggedin metabase session detail. ' + userinfoapi, objLogInfo)

            var getuserinfo = await getdatafromUrl(userinfoapi, headers);
            var metabaseUid = getuserinfo.personal_collection_id; //getuserinfo.id;
            _printInfo('Got the session details from metabse. User id | ' + metabaseUid, objLogInfo)


            var ouranalyticsUrl = `${urlResp}/api/collection/root/items?models=dashboard&models=dataset&models=card&models=snippet&models=pulse&pinned_state=is_not_pinned&limit=250&offset=0&sort_column=name&sort_direction=asc`
            var PersonalCollectionUrl = `${urlResp}/api/collection/${metabaseUid}/items?models=dashboard&models=dataset&models=card&models=snippet&models=pulse&pinned_state=is_not_pinned&limit=250&offset=0&sort_column=name&sort_direction=asc`
            var ouranalyticsUrlResponse = await getdatafromUrl(ouranalyticsUrl, headers);
            var PersonalCollectionData = await getdatafromUrl(PersonalCollectionUrl, headers);
            var allCollection = [];
            var ouranalyticsUrlData = ouranalyticsUrlResponse.data
            var PersonalCollectionData = PersonalCollectionData.data
            if (ouranalyticsUrlData) {
                _prepareResult(ouranalyticsUrlData)
            }
            if (PersonalCollectionData) {
                _prepareResult(PersonalCollectionData)
            }
            _SendResponse(allCollection, '', '', null, null, objLogInfo);

            function _prepareResult(arrdata) {
                try {
                    for (var i = 0; i < arrdata.length; i++) {
                        allCollection.push({
                            "question_id": arrdata[i].id,
                            "question_description": arrdata[i].name,
                            "question_created_on": arrdata[i]["last-edit-info"].timestamp,
                            "user_id": arrdata[i]["last-edit-info"].id
                        })
                    }

                } catch (error) {
                    sendErrorResponse("Error While Invoking getMetabaseURL.then method", error)
                }
            }


            // urlResp = 'http://192.168.2.213:29191/metabase'
            // request.get({
            //     "url": urlResp + "/api/card",
            //     "headers": {
            //         "X-Metabase-Session": body.sessionid
            //     },
            //     json: true
            // }, function (err, httpResponse, respbody) {
            //     if (err) {
            //         sendErrorResponse("Third Party API URL Calling Failed", err)
            //     } else {
            //         if (respbody.length > 0) {
            //             var dataFromActivity = []
            //             for (var dat of respbody) {
            //                 // if (dat['model'] === 'card') {
            //                 dataFromActivity.push({
            //                     // "project_id": body.project_id,
            //                     // "project_id": dat.id,
            //                     "question_id": dat['id'],
            //                     "question_description": dat.name,
            //                     "question_created_on": dat.created_at,
            //                     // "user_id": objLogInfo.USER_ID
            //                     "user_id": dat.creator_id
            //                 })
            //                 // }
            //             }

            //             _SendResponse(dataFromActivity, '', '', null, null, objLogInfo);
            //         } else {
            //             sendSuccessResponse("Sync Success");
            //         }
            //     }
            // })
        }).catch((error) => {
            sendErrorResponse("Error While Invoking getMetabaseURL method", error)
        })


        function getMetabaseURL() {
            return new Promise(async (resolve, reject) => {
                _printInfo('Getting Metabase Url from redis ', objLogInfo)
                redisInstance.GetRedisConnection(function (error, clientR) {
                    if (error) {
                        reject(error);
                    } else {
                        var redis_key_name = "ANALYTICS_TP"
                        _printInfo('Redis key name  ' + redis_key_name, objLogInfo)
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
                                    _printInfo('Got the metabse  Url from redis. Url is ' + urlResp, objLogInfo)
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


        async function getdatafromUrl(pUrl, pHeaders) {
            return new Promise((resolve, reject) => {
                try {
                    request.get({
                        "url": pUrl,
                        "headers": pHeaders,
                        json: true
                    }, function (err, httpResponse, body) {
                        if (err) {
                            sendErrorResponse("Third Party API URL Calling Failed", err)
                        } else {
                            resolve(body);
                        }
                    })

                } catch (error) {
                    sendErrorResponse("Exception occured getdatafromUrl function.", error)
                }
            })

        }

    })

    // To send the app response
    function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning, pobjLogInfo) {
        var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
        var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
        return reqInstanceHelper.SendResponse('ChangeSearchTag', appResp, ResponseData, pobjLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
    }
    function sendErrorResponse(message, error) {
        reqInstanceHelper.SendResponse('getquestions', appResp, null, {}, '', message, error);
    }
    function errorHandler(errcode, message) {
        console.log(errcode, message);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }

})

module.exports = router;