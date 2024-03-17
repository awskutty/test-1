/*
    @Api_Name           : /LoadTransactions
    @Description        : To retrieve data from transaction DB
    @Last Error Code    : 'ERR-TRX-100212'
*/

// Require dependencies
var reqExpress = require('express');
var reqLoadTransactionsHelper = require('./helper/LoadTransactionsHelper');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var router = reqExpress.Router();
var strServiceName = 'LoadTransactions';

// Host api to express
router.post('/LoadTransactions', function LoadTransactions(appRequest, appResponse) {
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
                    reqLoadTransactionsHelper.FinishApiCall();
                    reqLogWriter.EventUpdate(objLogInfo);
                });
                appResponse.on('finish', function() {
                    reqLoadTransactionHelper.FinishApiCall();
                });
                appResponse.on('end', function() {
                    reqLoadTransactionHelper.FinishApiCall();
                });
                reqInstanceHelper.PrintInfo(strServiceName, 'Begin', objLogInfo);
                var params = appRequest.body.PARAMS;
                var headers = appRequest.headers;
                var sessionInfoKeys = Object.keys(objSessionInfo);
                // This loop is for merge session values with params
                for (var i = 0; i < sessionInfoKeys.length; i++) {
                    var currentKey = sessionInfoKeys[i];
                    params[currentKey] = objSessionInfo[currentKey];
                }
                // Call hepler class function
                reqLoadTransactionsHelper.LoadTransactions(params, headers, objLogInfo, function(error, result, info) {
                    try {
                        if (error) {
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, error.ERROR_CODE, error.ERROR_MESSAGE, error.ERROR);
                        } else if (info) {
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, '', '', '', 'FAILURE', info);
                        } else {
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, result, objLogInfo);
                        }
                    } catch (error) {
                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-TRX-100201', 'Error in reqLoadTransactionsHelper.LoadTransactions callback', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-TRX-100202', 'Error in reqLogInfo.AssignLogInfoDetail callback', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', null, 'ERR-TRX-100203', 'Error in LoadTransactions function', error);
    }
});

module.exports = router;
/********* End of Service *********/