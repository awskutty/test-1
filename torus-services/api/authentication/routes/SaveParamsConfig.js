/*
@Api_Name : /SaveParamsConfig,
@Description: To save tenant_setup params to DB
 * @Last_Error_code:ERR-UI-110701
*/

// Require dependencies
var modPath = '../../../../node_modules/'
var appRoot = '../../../../torus-references'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqLinq = require(modPath + 'node-linq').LINQ;
var reqFXDBInstance = require(appRoot + '/instance/DBInstance')
var reqRedisInstance = require('../../../../torus-references/instance/RedisInstance');
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance');
var reqLogInfo = require(appRoot + '/log/trace/LogInfo');
var reqInsHelper = require(appRoot + '/common/InstanceHelper');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
// Global variable initialization 

var defaultRedisKey = 'clt-0~app-0~tnt-0~env-0';
var updateobj;
var updatecond;
var strServiceName = 'SaveParamsConfig'
router.post('/SaveParamsConfig', function (appRequest, appResponse, next) {
    var objLogInfo = ''
    var prctID = '';
    var strAppId='';
    var pResp='';
    var process = appRequest.body.PARAMS.PROCESS;
    var strTntId = appRequest.body.PARAMS.TENANT_ID;
    var setup_master_override = appRequest.body.PARAMS.setup_master_model;
    var connString = ''
    var CondObj = {};
    pResp = appResponse;
    
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, session_info) {
            objLogInfo = pLogInfo;
            var strInputParamJson = appRequest.body.PARAMS.SELROW;
            var NewColumnkey = appRequest.body.PARAMS.NewColumn;
            var NewColumnValue = appRequest.body.PARAMS.NewColumnValue;
            var strClient_id = session_info.CLIENT_ID;
            var strUserID = session_info.U_ID;
            
            
            // Handle the api close event from when client close the request
            reqTranDBHelper.GetTranDBConn(appRequest.headers, false, function (tran_db_instance) {
                reqAuditLog.GetProcessToken(tran_db_instance, objLogInfo, function (error, prct_id) {
                    appResponse.on('close', function () { });
                    appResponse.on('finish', function () { });
                    appResponse.on('end', function () { });
                    _PrintInfo('Begin');
                    // Initialize local variables
                    
                    
                    // var NewColumnkeyArr = NewColumnkey.split(',');
                    // var NewColumnValueArr = NewColumnValue.split(',');
                    strAppId = session_info.APP_ID;  
                    prctID = prct_id;
                    //strInputParamJson.Isnew = true;

                    objLogInfo.PROCESS = 'SaveParamsConfig-UI';
                    objLogInfo.ACTION_DESC = 'SaveParamsConfig';
                    updatesetup = false;
                    // Function call
                    if (process != 'tenant_setup') {

                        checkAlreadyExist(function alreadyExist(error, result) {
                            if (updatesetup == false) {
                                strInputParamJson.Isnew = true
                                _Prepareparams();
                            } else {
                                _Prepareparams();
                            }
                        })


                    } else {
                        _Prepareparams()
                    }
                })
            })


            function checkAlreadyExist(existcallback) {
                try {
                    reqFXDBInstance.GetFXDBConnection(appRequest.headers, 'clt_cas', objLogInfo, async function Callback_GetCassandraConn(mClient) {
                        await reqFXDBInstance.setSearchPath(mClient, ['tran_db', 'clt_cas'], objLogInfo);

                        var routkey = appRequest.headers['routingkey']

                        CondObj = {
                            setup_code: strInputParamJson.label,
                        }
                        if (NewColumnkey && NewColumnValue) {
                            CondObj[NewColumnkey] = NewColumnValue
                        }



                        reqFXDBInstance.GetTableFromFXDB(mClient, process, [], CondObj, objLogInfo, function SELTCLIENT(pError, pResult) {
                            if (pError) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-110801', 'Error In tenant_setup_version Table Execution', pError);
                            } else if (pResult) {
                                if (pResult.rows.length > 0) {
                                    updatesetup = true
                                    existcallback();
                                } else {
                                    existcallback()
                                }
                            }
                        });
                    })
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-111005', 'Error In Prepareparams function', error);
                }
            }


            function _Prepareparams() {
                connString = 'LDAP'
                var redisvalue = ''
                try {
                    reqFXDBInstance.GetFXDBConnection(appRequest.headers, 'clt_cas', objLogInfo, async function Callback_GetCassandraConn(mClient) {
                        await reqFXDBInstance.setSearchPath(mClient, ['tran_db', 'clt_cas'], objLogInfo);
                        var redisKeyDefault = connString + '~' + defaultRedisKey.toUpperCase();
                        var routkey = appRequest.headers['routingkey']
                        if (strInputParamJson.Isnew) {
                            if (process == 'tenant_setup') {
                                CondObj = {
                                    setup_json: strInputParamJson.setup_json,
                                    schema_json: strInputParamJson.setup_schema,
                                    routing_key: routkey,
                                    tenant_id: strTntId,
                                    client_id: strClient_id,
                                    category: strInputParamJson.label || strInputParamJson.category,
                                    editor_type: strInputParamJson.editor_type,
                                    description: strInputParamJson.label,
                                    version: 0,
                                    created_by: strUserID,
                                    created_by_name: objLogInfo.LOGIN_NAME,
                                    created_clientip: objLogInfo.CLIENTIP,
                                    created_date: reqDateFormater.GetTenantCurrentDateTime(appRequest.headers, objLogInfo),
                                    created_date_utc: reqDateFormater.GetCurrentDateInUTC(appRequest.headers, objLogInfo),
                                    prct_id:prctID
                                }
                            } else {
                                CondObj = {
                                    setup_code: strInputParamJson.label
                                }
                                if (process != 'setup_master_override') {
                                    CondObj['setup_json'] = strInputParamJson.setup_json;
                                }

                                if (NewColumnkey && NewColumnValue) {
                                    CondObj[NewColumnkey] = NewColumnValue
                                }
                            }

                            reqFXDBInstance.InsertFXDB(mClient, process, [CondObj], objLogInfo, function SELCLIENT(pError, pResult) {
                                if (pError) {
                                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-111001', 'Error In tenant_setup Table Execution', pError);
                                } else {
                                    try {
                                        if (process == 'tenant_setup') {
                                            _saveLdap(strInputParamJson);
                                        } else {
                                            reqInsHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, null, null, null);
                                        }

                                    } catch (error) {
                                        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-111002', 'Error In SaveLdap function call', error);
                                    }
                                }
                            });
                        } else {
                            if (process == 'tenant_setup') {
                                updateobj = {
                                    setup_json: strInputParamJson.setup_json,
                                    modified_date: reqDateFormater.GetTenantCurrentDateTime(appRequest.headers, objLogInfo),
                                    modified_date_utc: reqDateFormater.GetCurrentDateInUTC(appRequest.headers, objLogInfo),
                                    modified_by: strInputParamJson.modified_by,
                                    modified_by_name:objLogInfo.LOGIN_NAME,
                                    modified_clientip: objLogInfo.CLIENTIP,
                                    routing_key: routkey,
                                    prct_id: prctID
                                }

                                CondObj = {
                                    tenant_id: strTntId,
                                    client_id: strClient_id,
                                    category: strInputParamJson.label || strInputParamJson.category,
                                    // editor_type:strInputParamJson.editor_type,
                                }
                            } else {
                                updateobj = {
                                    setup_json: strInputParamJson.setup_json
                                    
                                    // [NewColumnkey]: NewColumnValue
                                }

                                CondObj = {
                                    setup_code: strInputParamJson.label
                                    // editor_type:strInputParamJson.editor_type,
                                }

                                if (NewColumnkey && NewColumnValue) {
                                    CondObj[NewColumnkey] = NewColumnValue
                                }
                               

                            }

                        reqFXDBInstance.UpdateFXDB(mClient, process, updateobj, CondObj, objLogInfo, function SELTCLIENT(pError, pResult) {
                                if (pError) {
                                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-111003', 'Error In tenant_setup update  Execution', pError);
                                } else {
                                    try {
                                        if (process == 'tenant_setup') {
                                            _saveLdap(strInputParamJson);
                                        } else {
                                            reqInsHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, null, null, null);
                                        }

                                    } catch (error) {
                                        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-111004', 'Error In SaveLdap function call', error);
                                    }
                                }
                            });
                        }
                    })
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-111005', 'Error In Prepareparams function', error);
                }
            }
        })
    } catch (error) {
        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-111006', 'Error In LoadParamsConfig function', error);
    }

    function errorHandler(errcode, message) {
        console.log(message, errcode);
        reqLogWriter.TraceError(objLogInfo, message, errcode);
    }

    function _saveLdap(strInputParamJson) {
        if (strInputParamJson.label == 'LDAP_INFO') {
            reqInsHelper.GetRedisKey(connString, appRequest.headers['routingkey'], function (redisKey) {
                reqInsHelper.IsRedisKeyAvail(redisKey, function (result) {
                    if (result) {
                        redisvalue = redisKey
                    } else {
                        redisvalue = redisKeyDefault
                    }
                    reqRedisInstance.GetRedisConnection(function (error, clientR) {
                        if (error) {
                            console.log(error);
                        } else {
                            clientR.set(redisvalue, strInputParamJson.setup_json);
                            clientR.bgsave();
                            clientR.get(redisvalue, function (err, object) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, null, null, null);
                            });
                        }
                    });
                })


            })


        } else {
            reqInsHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, null, null, null);
        }

    }
    // Print Log information
    function _PrintInfo(pMessage) {
        reqInsHelper.PrintInfo(strServiceName, pMessage, objLogInfo)
    }
    // Print Log Error
    function _PrintErr(pError, pErrorCode, pMessage) {
        reqInsHelper.PrintError(strServiceName, pError, pErrorCode, objLogInfo, pMessage)
    }
});



module.exports = router;
// End function