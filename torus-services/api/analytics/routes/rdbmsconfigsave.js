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
var request = require(modPath + 'request');
// Initialize Global variables

var strResult = '';
var strMessage = '';

var router = express.Router();
var strHeader = {};
var strHeader1 = {};

// Host the login api
router.post('/rdbmsconfigsave', function (appReq, appResp) {
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
        objLogInfo.PROCESS = 'rdbmsconfigsave-Analytics';
        objLogInfo.ACTION = 'rdbmsconfigsave';

        try {
            redisInstance.GetRedisConnection(function (error, clientR) {
                if (error) {
                    _SendResponse({}, 'Errcode', 'Error while update Programs Table', pError, null);
                } else {
                    var redis_key_name = "rdbms_" + appReq.body[0].connectionname
                    clientR.get(redis_key_name, function (err, reply) {
                        if (err) {
                            _SendResponse({}, 'Errcode', 'Error while update Programs Table', err, null);
                        } else {
                            if (reply == null) {


                                getMetabaseURL().then((urlResponse) => {

                                    var url = urlResponse + "/api/database/"


                                    var metabasedetails = {
                                        "host": appReq.body[0].connectionip,
                                        "port": appReq.body[0].port,
                                        "dbname": appReq.body[0].databasename,
                                        "user": appReq.body[0].username,
                                        "password": appReq.body[0].passwordd,
                                        "tunnel-port": 22,
                                        "ssl": true
                                    }

                                    var mbBody = {};
                                    mbBody['name'] = appReq.body[0].connectionname;
                                    mbBody['engine'] = appReq.body[0].engine;
                                    mbBody['details'] = metabasedetails;
                                    mbBody['is_full_sync'] = true;
                                    mbBody['is_on_demand'] = false;


                                    request.post({
                                        "url": url,
                                        "body": mbBody,
                                        "headers": {
                                            "X-Metabase-Session": appReq.body[0].sessionid
                                        },
                                        json: true
                                    }, function (err, httpResponse, body) {
                                        if (err) {
                                            console.log(pError)
                                            _SendResponse({}, 'Errcode', 'Error while update Programs Table', err, null);
                                        } else {
                                            if (body.id == undefined) {
                                                _SendResponse({}, 'Errcode', 'Error while syncing with metabase', body.errors, null);
                                            } else {
                                                clientR.set(redis_key_name, JSON.stringify(appReq.body[0]), function (err, object) {
                                                    if (err) {
                                                        _SendResponse({}, 'Errcode', 'Error while update Programs Table', err, null);
                                                    } else {

                                                        _SendResponse('SUCCESS', '', '', null, null);
                                                    }
                                                })
                                            }

                                        }
                                    })
                                    // reqTranDBInstance.GetTranDBConn(strHeader1, false, function callbackGetTranDB(pSession) {
                                    //     var dt=new Date();
                                    //     var metabasedetails={  
                                    //         "host":appReq.body[0].connectionip,
                                    //         "port":appReq.body[0].port,
                                    //         "dbname":appReq.body[0].databasename,
                                    //         "user":appReq.body[0].username,
                                    //         "password":appReq.body[0].passwordd,
                                    //         "tunnel-port":22,
                                    //         "ssl":true
                                    //      }


                                    //      var stringmd=JSON.stringify(metabasedetails);
                                    //     reqTranDBInstance.InsertTranDBWithAudit(pSession, 'metabase_database', [{
                                    //         created_at:dt,
                                    //         updated_at: dt,
                                    //         name: appReq.body[0].connectionname,
                                    //         description: appReq.body[0].connectionname,
                                    //         details: stringmd,
                                    //         engine: 'postgres',
                                    //         is_sample: false,
                                    //         is_full_sync: true,
                                    //         metadata_sync_schedule:'0 50 * * * ? *',
                                    //         cache_field_values_schedule:'0 50 0 * * ? *',
                                    //         timezone:'Asia/Kolkata',
                                    //         is_on_demand:false
                                    //     }], objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
                                    //         if (pError){
                                    //           console.log(pError)
                                    //             _SendResponse({}, 'Errcode', 'Error while update Programs Table', pError, null);
                                    //         }

                                    //         else{
                                    //             _SendResponse('SUCCESS','','',null,null );

                                    //         }


                                    //     })
                                    // })


                                })

                            } else {
                                _SendResponse('FAILURE', 'Key already exist', 'Key already exist', 'Key already exist', null);
                            }

                        }

                    });
                }

            });
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
    });


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

})

module.exports = router;