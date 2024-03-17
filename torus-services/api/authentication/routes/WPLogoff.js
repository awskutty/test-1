/*
@Api_Name           : /GetWFInfo,
@Description        : To  LOGOFF the user and clear the users session from DB and redis,
@Last_Error_Code    : ERR-AUT-10609
@Last_modified for  : Framework Release changes not reflected in 220 Env 
*/


// Require dependencies
var modPath = '../../../../node_modules/';
var reqExpress = require(modPath + 'express');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var serviceModel = DBInstance.DBInstanceSession['SERVICE_MODEL'];
var serviceHelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var serviceName = 'WPLogoff';

var router = reqExpress.Router();

// Host the logout api
router.post('/WPLogoff', function callbackDoLogout(appRequest, appResponse) {

    // Initialize Global variables
    var strResult = '';
    var strMessage = '';
    var objLogInfo;
    try {
        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            objLogInfo.PROCESS = 'WPLogoff-Authentication';
            objLogInfo.ACTION = 'WPLogoff';
            objLogInfo.HANDLER_CODE = 'Do_WP_Logoff';
            serviceModel.NEED_SYS_ROUTING = 'N'; // To set Need system routing 'N'
            var headers = appRequest.headers;
            var U_ID = sessionInfo.U_ID;
            var LoginName = sessionInfo.LOGIN_NAME;
            var clientId = sessionInfo.CLIENT_ID;
            // var extLogouturl = appRequest.body.PARAMS.ExtUrl
            var NeedextrAuth = sessionInfo.NEED_EXT_AUTH;
            var accessToken = sessionInfo.EXT_AUTH_TOKEN_BLOCKCHAIN;
            DBInstance.GetFXDBConnection(appRequest.headers, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(mClient) {
                try {
                    reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
                    appResponse.setHeader('Content-Type', 'application/json');
                    var tmpIp = appRequest.connection.remoteAddress;
                    tmpIp = tmpIp.split(':');
                    var strClientIp = tmpIp[tmpIp.length - 1];
                    // Initialize local variables
                    var sessionID = appRequest.headers['session-id'];
                    if (sessionID == undefined) {
                        sessionID = appRequest.body.SESSION_ID;
                    }
                    var Logout_Mode = appRequest.body.PARAMS.Logout_Mode || '';
                    var loginName = appRequest.body.PARAMS.LoginName || objLogInfo.LOGIN_NAME;
                    var params = {
                        U_ID: U_ID,
                        SESSION_ID: sessionID,
                        LOGINIP: appRequest.body.PARAMS.pLoginIP,
                        NeedextrAuth: NeedextrAuth,
                        Logout_Mode: Logout_Mode,
                        loginName: loginName
                    };
                    // main function call and result will send from here
                    // logoff(function (finalcallback) {
                    serviceHelper.Logout(headers, mClient, params, appRequest, appResponse, objLogInfo, function (res) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, res.Status, objLogInfo, res.ErrorCode, res.ErrorMsg, res.Error);
                    });
                } catch (error) {
                    return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-10603', 'Exception Occured While AssignLogInfoDetail function', error, '', '');
                }
            });
        });
    } catch (error) {
        return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-10604', 'Exception Occured While WPLogoff function', error, '', '');
    }


});

function sendMethodResponse(status, successMessage, SuccessDataObj, errorCode, errorMessage, errorObject) {
    var obj = {
        'STATUS': status,
        'SUCCESS_MESSAGE': successMessage,
        'SUCCESS_DATA': SuccessDataObj,
        'ERROR_CODE': errorCode,
        'ERROR_MESSAGE': errorMessage,
        'ERROR_OBJECT': errorObject
    };
    return obj;
}

//Commin Result  Preparation


module.exports = router;
//*******End of Serive*******//