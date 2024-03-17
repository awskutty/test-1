/*
@Api_Name            : /GetDisclaimerMessage,
@Description         : Get the disclaimer message from application table that is not matched with appuser disclaimer message,
@Last_Error_Code     : ERR-AUT-14407
*/

// Require dependencies
var modPath = '../../../../node_modules/'
var refPath = '../../../../torus-references/'
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqLINQ = require(modPath + "node-linq").LINQ;
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

// Global variable initialization
var pHeaders = '';
var mClient = '';
var strServiceName = 'GetDisclaimerMessage'

// Host the method to express
router.post('/GetDisclaimerMessage', function(appRequest, appResponse, next) {
    var objLogInfo = {}
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function CallbackLogInfo(pLogInfo, pSessionInfo) {
            // Handle the close event when client close the connection
            appResponse.on('close', function() {});
            appResponse.on('finish', function() {});
            appResponse.on('end', function() {});

            objLogInfo = pLogInfo;
            reqInstanceHelper.PrintInfo(strServiceName, 'Begin', objLogInfo);
            objLogInfo.PROCESS = 'GetDisclaimerMessage-Authentication';
            objLogInfo.ACTION_DESC = 'GetDisclaimerMessage';
            objLogInfo.HANDLER_CODE = 'GET_DISCLAIMER_MESSAGE';

            var strUSERID = pSessionInfo.U_ID;
            var strAPPID = appRequest.body.PARAMS.APP_ID;
            var strLOGINNAME = appRequest.body.PARAMS.LOGIN_NAME;
            var strCLIENTID = appRequest.body.PARAMS.CLIENT_ID;

            pHeaders = appRequest.headers;
            DBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                mClient = pClient;
                GetDisclaimerMessage();

                // Get disclaimer message from applications table 
                function GetDisclaimerMessage() {
                    try {
                        reqInstanceHelper.PrintInfo(strServiceName, 'Query applications table', objLogInfo)
                        DBInstance.GetTableFromFXDB(mClient, 'applications', ['disclaimer_message'], {
                            'client_id': strCLIENTID,
                            'is_framework': 'N',
                            'app_id': strAPPID
                        }, objLogInfo, function callbackAPPLICATIONSELECT(err, appResult) {
                            try {
                                if (err) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-AUT-14401', 'Error while querying applications ', err)
                                    return
                                } else {
                                    if (appResult.rows.length > 0) {
                                        var strAPPDISCLAIMERMSG = appResult.rows[0].disclaimer_message;
                                        DBInstance.GetTableFromFXDB(mClient, 'app_users', [], {
                                            'u_id': strUSERID,
                                            'app_id': strAPPID
                                        }, objLogInfo, function callbackUSERSELECT(err, userResult) {
                                            try {
                                                if (err) {
                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-AUT-14402', 'Error while querying app_users ', err)
                                                    return
                                                } else {
                                                    var strUSERDISCLAIMERMSG = userResult.rows[0].disclaimer_message
                                                    var app = {};
                                                    if (strAPPDISCLAIMERMSG != strUSERDISCLAIMERMSG) {
                                                        app.disclaimer_content = strAPPDISCLAIMERMSG;
                                                        app.disclaimer_message = 'N';
                                                    } else {
                                                        app.disclaimer_message = 'Y';
                                                        reqInstanceHelper.PrintInfo(strServiceName, 'disclaimer_message same ', objLogInfo)
                                                    }
                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, app, objLogInfo)
                                                    return
                                                }
                                            } catch (error) {
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-AUT-14403', 'Error in GetDisclaimerMessage function ', error)
                                                return
                                            }
                                        })
                                    } else {
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-AUT-14404', 'Application not found in app_users ', null)
                                        return
                                    }
                                }
                            } catch (error) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-AUT-ERR-AUT-14407', 'callbackAPPLICATIONSELECT function failed ', null)
                                return
                            }
                        })
                    } catch (error) {
                        reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-AUT-14405', 'Error in GetDisclaimerMessage function ', error)
                        return
                    }
                }
            });
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-AUT-14406', 'Error in GetDisclaimerMessage function', error)
        return
    }
})
module.exports = router;
/*******End of Serive*******/