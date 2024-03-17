/* 
@Api_Name           : /GetClientTheme,
@Description        : To get the Client Theme from tenant setup
@Last_Error_code    : ERR-AUT-13504
*/

// Require dependencies
var node_modules = '../../../../node_modules/';
var referenceRoot = '../../../../torus-references';
var reqExpress = require(node_modules + 'express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var DBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
//Global Variables
var mCltClient = '';
var pHeaders = '';
var serviceName = 'GetClientTheme';

// Host the GetClientTheme api
router.get('/GetClientTheme', function (appRequest, appResponse, pNext) {
    var objLogInfo;
    var serviceModel = DBInstance.DBInstanceSession['SERVICE_MODEL'];
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        try {
            // Handle the close event when client close the connection
            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });

            objLogInfo.PROCESS = 'GetClientTheme-Authentication';
            objLogInfo.ACTION = 'GetClientTheme';
            objLogInfo.HANDLER_CODE = 'GET_CLIENT_THEME';

            reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
            pHeaders = appRequest.headers;
            DBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                mCltClient = pClient;
                appResponse.setHeader('Content-Type', 'application/json');
                var strClientId = appRequest.query.pClientId;
                var strTENANTID = appRequest.query.TENANT_ID;
                var strRes = 'No Theme';
                GetClientTheme();

                // Query the tenant setup for category - THEME
                function GetClientTheme() {
                    try {
                        var cond = {};
                        cond.setup_code = '';
                        if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                            reqsvchelper.GetSetupJson(pClientClt, cond, objLogInfo, function (res) {
                                if (res.Status == 'SUCCESS' && res.Data.length) {
                                    strRes = res.Data[0].setup_json;
                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, JSON.stringify(strRes), objLogInfo, '', '', '');
                                } else {
                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, strRes, objLogInfo, '', '', '', 'FAILURE', 'NO THEME FOUND');
                                }
                            });
                        } else {
                            DBInstance.GetTableFromFXDB(mCltClient, 'tenant_setup', ['setup_json'], {
                                'tenant_id': strTENANTID,
                                'category': 'THEME',
                                'client_id': strClientId
                            }, objLogInfo, function callbackClientSetup(error, pResult) {
                                try {
                                    if (error) {
                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-13501', 'Error while executing query from tenant_setup table', error);
                                    } else {
                                        if (pResult.rows.length > 0) {
                                            strRes = pResult.rows[0].setup_json;
                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, JSON.stringify(strRes), objLogInfo, '', '', '');
                                        } else {
                                            reqInstanceHelper.PrintInfo(serviceName, 'No Theme Found', objLogInfo);
                                            return reqInstanceHelper.SendResponse(serviceName, appResponse, strRes, objLogInfo, '', '', '', 'FAILURE', 'NO THEME FOUND');
                                        }
                                    }
                                } catch (error) {
                                    return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-13502', 'Exception occured', error);
                                }
                            });
                        }
                    } catch (error) {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-13503', 'Exception occured', error);
                    }
                }
            });
        } catch (error) {
            return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-AUT-13504', 'Exception occured initally', error);
        }
    });
});

module.exports = router;
/******** End of Service ********/