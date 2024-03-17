/*
    @Api_Name           : /LoadTransaction,
    @Description        : To retrieve data from transaction DB,
    @Last Error Code    : 'ERR-TRX-100112'
*/

// Require dependencies
var reqExpress = require('express');
var reqLoadTransactionHelper = require('./helper/LoadTransactionHelper');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var router = reqExpress.Router();
var serviceName = 'LoadTransaction';

// Host api to server
router.post('/LoadTransaction', function LoadTransaction(appRequest, appResponse) {
    var objLogInfo;
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function(objLogInfo, objSessionInfo) {
            try {

                appResponse.on('close', function() {});
                appResponse.on('finish', function() {});
                appResponse.on('end', function() {});
                objLogInfo.HANDLER_CODE = 'BIND_TRAN';
                // Handle the close event when client closes the api request
                appResponse.on('close', function() { // This will call unexpected close from client
                    reqLoadTransactionHelper.FinishApiCall();
                    reqLogWriter.EventUpdate(objLogInfo);
                });
                appResponse.on('finish', function() {
                    reqLoadTransactionHelper.FinishApiCall();
                });
                appResponse.on('end', function() {
                    reqLoadTransactionHelper.FinishApiCall();
                });
                reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
                var params = appRequest.body.PARAMS;
                var headers = appRequest.headers;
                var sessionInfoKeys = Object.keys(objSessionInfo);
                // This loop is for merge session values with params
                for (var i = 0; i < sessionInfoKeys.length; i++) {
                    var currentKey = sessionInfoKeys[i];
                    params[currentKey] = objSessionInfo[currentKey];
                }
                // Call hepler class function
                reqLoadTransactionHelper.LoadTransaction(params, headers, objLogInfo, function(error, result, info) {
                    try {
                        if (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, error.ERROR_CODE, error.ERROR_MESSAGE, error.ERROR);
                        } else if (info) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, '', '', '', 'FAILURE', info);
                        } else {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, result, objLogInfo);
                        }
                    } catch (error) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-TRX-100102', 'Error in reqLoadTransactionHelper.LoadTransaction callback', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-TRX-100103', 'Error in reqLogInfo.AssignLogInfoDetail callback', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, '', null, 'ERR-TRX-100104', 'Error in LoadTransaction function', error);
    }
});

module.exports = router;
/********* End of Service *********/