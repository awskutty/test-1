/*
@Api_Name           : /SendForgotPwdOTP,
@Description        : To Save the disclaimer message from application table into app_users table,
@Last_Error_Code    : ERR-AUT-11008
*/

// Require dependencies
var modPath = '../../../../node_modules/'
var refPath = '../../../../torus-references/';
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

// Global Variable initialization
var pHeaders = '';
var serviceName = 'SaveDisclaimerMessage';
var mClient = '';

// Host api to server
router.post('/SaveDisclaimerMessage', function(appRequest, appResponse) {
    appResponse.on('close', function() {});
    appResponse.on('finish', function() {});
    appResponse.on('end', function() {});
    var objLogInfo;
    reqLogInfo.AssignLogInfoDetail(appRequest, function(objLogInfo, sessionInfo) {
        try {
            objLogInfo.PROCESS = 'SaveDisclaimerMessage-Authentication';
            objLogInfo.ACTION = 'SaveDisclaimerMessage';
            objLogInfo.HANDLER_CODE = 'Save_Disclaimer_Message';
            reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
            pHeaders = appRequest.headers;
            DBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                mClient = pClient;
                appResponse.setHeader('Content-Type', 'text/plain');
                var strResult = '';
                var strDmsg = appRequest.body.PARAMS.DISCLAIMER_MESSAGE;
                var strUid = appRequest.body.PARAMS.U_ID;
                var strAppid = appRequest.body.PARAMS.APP_ID;
                var strLoginName = appRequest.body.PARAMS.LOGIN_NAME;
                var strClientId = appRequest.body.PARAMS.CLIENT_ID;
                var strDisclaimer = 'N';

                //Funcrion call
                SaveDisclaimerMessage(function(finalcallback) {
                    if (finalcallback.STATUS == 'SUCCESS') {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, finalcallback.SUCCESS_DATA, objLogInfo, '', '', '', 'SUCCESS', finalcallback.SUCCESS_MESSAGE);
                    } else {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, finalcallback.ERROR_CODE, finalcallback.ERROR_MESSAGE, finalcallback.ERROR_OBJECT);
                    }
                });

                //Prepare function
                function SaveDisclaimerMessage(finalcallback) {
                    try {
                        reqInstanceHelper.PrintInfo(serviceName, 'SaveDisclaimerMessage function  executing,GetTableFromFXDB app_users table', objLogInfo);
                        DBInstance.GetTableFromFXDB(mClient, 'app_users', [], {
                            'app_id': strAppid,
                            'u_id': strUid
                        }, objLogInfo, function callbackSavedisclaimer(err, appResult) {
                            try {
                                if (err) {
                                    finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-11001', 'GetTableFromFXDB users Failed ', err))
                                } else {
                                    if (appResult.rows.length > 0) {
                                        reqInstanceHelper.PrintInfo(serviceName, 'Got result from app_users table, Going to update app_users table with new disclaimer messages');
                                        DBInstance.UpdateFXDB(mClient, 'app_users', {
                                            'disclaimer_message': strDmsg,
                                            'disclaimer': strDisclaimer
                                        }, {
                                            'u_id': strUid,
                                            'app_id': strAppid,
                                            'appu_id': appResult.rows[0].appu_id
                                        }, objLogInfo, function callbackSavedisclaimer(pError, appuResult) {
                                            try {
                                                if (pError) {
                                                    finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-11002', 'UpdateFXDB users Failed ', pError))
                                                } else {
                                                    finalcallback(sendMethodResponse('SUCCESS', '', 'SUCCESS', '', '', ''));
                                                }
                                            } catch (error) {
                                                finalcallback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-11003', 'Exception Occured While executing callbackSavedisclaimer  function  ', error));
                                            }
                                        });
                                    } else {
                                        finalcallback(sendMethodResponse("FAILURE", '', '', 'ERR-AUT-11008', 'app_users rows not found ', err))
                                    }
                                }
                            } catch (error) {
                                finalcallback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-11004', 'Exception Occured While executing callbackSavedisclaimer  function  ', error));
                            }
                        })
                    } catch (error) {
                        finalcallback(sendMethodResponse('FAILURE', '', '', 'ERR-AUT-11005', 'Exception Occured While executing SaveDisclaimerMessage  function  ', error));
                    }
                }
            })

        } catch (error) {
            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-AUT-11006', 'Catch error - SaveDisclaimerMessage Router function', error);
        }
    })
});
//Commin Result  Preparation
function sendMethodResponse(status, successMessage, SuccessDataObj, errorCode, errorMessage, errorObject) {
    var obj = {
        'STATUS': status,
        'SUCCESS_MESSAGE': successMessage,
        'SUCCESS_DATA': SuccessDataObj,
        'ERROR_CODE': errorCode,
        'ERROR_MESSAGE': errorMessage,
        'ERROR_OBJECT': errorObject
    }
    return obj
}
module.exports = router;
//*******End of Serive*******//