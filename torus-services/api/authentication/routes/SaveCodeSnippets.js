/*
@Api_Name : /SaveCodeSnippets,
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
var reqLogInfo = require(appRoot + '/log/trace/LogInfo');
var reqInsHelper = require(appRoot + '/common/InstanceHelper');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
var uuid = require(modPath + 'uuid');
// Global variable initialization 

var defaultRedisKey = 'TRANDB~CLT-0~APP-0~TNT-0~ENV-0';

var strServiceName = 'SaveCodeSnippets'
router.post('/SaveCodeSnippets', function (appRequest, appResponse, next) {
    var objLogInfo = ''
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, session_info) {
            objLogInfo = pLogInfo
            // Handle the api close event from when client close the request

            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });
            _PrintInfo('Begin');
            // Initialize local variables
            var pResp = appResponse
            var strInputParam = appRequest.body.PARAMS;
            var strAppId = session_info.APP_ID;
            var strtntId = objLogInfo.TENANT_ID
            // var strClient_id = session_info.CLIENT_ID
            // var strTntId = appRequest.body.PARAMS.TENANT_ID;
            // var connString = ''
            var Action = appRequest.body.PARAMS.action;
            objLogInfo.PROCESS = 'SaveCodeSnippets-UI';
            objLogInfo.ACTION_DESC = 'SaveCodeSnippets';
            // Function call
            _Prepareparams()

            function _Prepareparams() {
                connString = 'TRANDB'
                var redisvalue = ''
                try {
                    reqFXDBInstance.GetFXDBConnection(appRequest.headers, 'dep_cas', objLogInfo, function Callback_GetCassandraConn(mClient) {
                        // var redisKeyDefault = connString + '~' + defaultRedisKey.toUpperCase();
                        // var routkey = appRequest.headers['routingkey']
                        if (Action == 'Save') {
                            reqFXDBInstance.InsertFXDB(mClient, 'code_snippets', [{
                                snippet_id: uuid.v1(),
                                app_id: strAppId,
                                created_by: strInputParam.created_by,
                                created_date: reqDateFormater.GetTenantCurrentDateTime(appRequest.headers, objLogInfo),
                                script: strInputParam.script,
                                snippet_name: strInputParam.snippet_name,
                                tenant_id: strtntId

                            }], objLogInfo, function SELCLIENT(pError, pResult) {
                                if (pError) {
                                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-111001', 'Error In code snippet Table Execution', pError);
                                } else {
                                    try {
                                        _saveLdap(strInputParam);

                                    } catch (error) {
                                        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-111002', 'Error In SaveLdap function call', error);
                                    }
                                }
                            });
                        } else if (Action == 'Update') {
                            reqFXDBInstance.UpdateFXDB(mClient, 'code_snippets', {
                                modified_date: reqDateFormater.GetTenantCurrentDateTime(appRequest.headers, objLogInfo),
                                modified_by: strInputParam.modified_by,
                                script: strInputParam.script

                            }, {

                                snippet_id: strInputParam.snippet_id,
                                snippet_name: strInputParam.snippet_name,
                                app_id: strAppId
                            }, objLogInfo, function UpdateCLIENT(pError, pResult) {
                                if (pError) {
                                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-111003', 'Error In Code Snippets update  Execution', pError);
                                } else {
                                    try {
                                        _saveLdap(strInputParam);

                                    } catch (error) {
                                        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-111004', 'Error In SaveLdap function call', error);
                                    }
                                }
                            });
                        } else if (Action == 'Delete') {
                            reqFXDBInstance.DeleteFXDB(mClient, 'code_snippets', {

                                snippet_id: strInputParam.snippet_id,
                                snippet_name: strInputParam.snippet_name,
                                app_id: strAppId,
                                tenant_id: strtntId
                            }, objLogInfo, function DeleteCLIENT(pError, pResult) {
                                if (pError) {
                                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-111003', 'Error In CodeSnippets Delete  Execution', pError);
                                } else {
                                    try {
                                        _saveLdap(strInputParam);

                                    } catch (error) {
                                        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-UI-111004', 'Error In SaveLdap function call', error);
                                    }
                                }
                            })
                        } else {
                            console.log('Action required')
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

    function _saveLdap(strInputParam) {
        if (strInputParam.label == 'LDAP_INFO') {
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
                            clientR.set(redisvalue, strInputParam.snippet_name);
                            clientR.bgsave();
                            reqInsHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, null, null, null);
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