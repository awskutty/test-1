/*
    @Api_Name           : /AtmtVersioningRollback,
    @Description        : To get file data form fx db
    @Last Error Code    : 'ERR-RES-71009'
*/

// Require dependencies
var reqExpress = require('express');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var router = reqExpress.Router();
var serviceName = 'AtmtVersioningRollback';

// Host api to server
router.post('/AtmtVersioningRollback', function(appRequest, appResponse) {
    var objLogInfo;
    try {
        var reqDoRollbackHelper = require('./helper/AtmtVersioningRollbackHelper');
        reqLogInfo.AssignLogInfoDetail(appRequest, function(objLogInfo, objSessionInfo) {
            try {
                objLogInfo.HANDLER_CODE = 'SAVE_TRAN'; // correct it
                // Handle the close event when client closes the api request
                appResponse.on('close', function() { // This will call unexpected close from client
                    reqDoRollbackHelper.FinishApiCall(appResponse);
                    reqLogWriter.EventUpdate(objLogInfo);
                });
                appResponse.on('finish', function() {
                    reqDoRollbackHelper.FinishApiCall(appResponse);
                });
                appResponse.on('end', function() {
                    reqDoRollbackHelper.FinishApiCall(appResponse);
                });
                reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
                var params = appRequest.body;
                var headers = appRequest.headers;
                var sessionInfoKeys = Object.keys(objSessionInfo);
                // This loop is for merge session values with params
                for (var i = 0; i < sessionInfoKeys.length; i++) {
                    var currentKey = sessionInfoKeys[i];
                    params[currentKey] = objSessionInfo[currentKey];
                }
                // Call hepler class function
                reqDoRollbackHelper.DoRollback(params, headers, objLogInfo, function(error, result, info) {
                    try {
                        if (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, error.ERROR_CODE, error.ERROR_MESSAGE, error.ERROR);
                        } else if (info) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, '', '', '', 'FAILURE', info);
                        } else {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, result, objLogInfo);
                        }
                    } catch (error) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-RES-71002', 'Error in reqDoRollbackHelper.AtmtVersioningRollback callback', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-RES-71003', 'Error in reqLogInfo.AssignLogInfoDetail callback', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-RES-71004', 'Error in AtmtVersioningRollback callback', error);
    }
});

module.exports = router;
/********* End of Service *********/