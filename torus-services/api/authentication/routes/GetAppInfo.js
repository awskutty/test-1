/*
@Api_Name           : /GetAppInfo,
@Description        : To get application information from app_info
@Last_Error_code    : ERR-AUT-14304
*/

// Require dependencies
var node_modules = '../../../../node_modules/'
var referenceRoot = '../../../../torus-references'
var reqExpress = require(node_modules + 'express')
var router = reqExpress.Router()
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');

// Global Variables

var serviceName = 'GetAppInfo';

// Host the GetAppInfo api
router.post('/GetAppInfo', function callbackDoLogout(appRequest, appResponse) {
var objLogInfo = "";
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function(objLogInfo, objSessionInfo) {
            

            objLogInfo.HANDLER_CODE = 'GET_APP_INFO';
            objLogInfo.PROCESS = 'GetAppInfo-Authentication';
            objLogInfo.ACTION = 'GetAppInfo';

            // Handle the close event when client closes the api request
            appResponse.on('close', function() {});
            appResponse.on('finish', function() {});
            appResponse.on('end', function() {});

            reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)

            var params = appRequest.body.PARAMS;
            reqDBInstance.GetFXDBConnection(appRequest.headers, 'dep_cas', objLogInfo, function Callback_GetCassandraConn(pClient) {
                try {
                    reqInstanceHelper.PrintInfo(serviceName, 'Getting APP_INFO Details', objLogInfo)
                    reqDBInstance.GetTableFromFXDB(pClient, 'APP_INFO', [], {
                        client_id: params.CLIENT_ID,
                        app_id: params.APP_ID
                    }, objLogInfo, function(error, result) {
                        try {
                            if (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, "ERR-AUT-14301", "Error while querying APP_INFO table", error, "", "")
                                return
                            } else {
                                if (result.rows.length > 0) {
                                    var resData = result.rows[0];
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, resData, objLogInfo, null, null, null, "", "")
                                    return
                                } else {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, "", objLogInfo, null, null, null, "FAILURE", "No Data Found")
                                    return
                                }
                            }
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, "ERR-AUT-14302", "Exception occured", error, "", "")
                            return
                        }
                    });
                } catch (error) {
                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, "ERR-AUT-14303", "Exception occured", error, "", "")
                    return
                }
            });
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, "ERR-AUT-14304", "Exception occured initially", error, "", "")
        return
    }
});

module.exports = router;
/*********** End of Service **********/