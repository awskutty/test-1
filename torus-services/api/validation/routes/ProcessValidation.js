/*
    @Api_Name : /ProcessValidation
    @Description: To validate and change status
    @Last Error Code : 'ERR-VAL-120030'
*/

// Require dependencies
var reqExpress = require('express');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var router = reqExpress.Router();
var serviceName = 'ProcessValidation';

// Host api to server
router.post('/ProcessValidation', function (appRequest, appResponse) {
    try {
        var reqProcessValidationHelper = require('./helper/ProcessValidationHelper.js');
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            try {
                objLogInfo.HANDLER_CODE = 'DO_PROCESS_VALIDATION'; //correct it
                appResponse.on('close', function () {
                    reqProcessValidationHelper.FinishApiCall(appResponse);
                    reqLogWriter.EventUpdate(objLogInfo);
                });
                appResponse.on('finish', function () {
                    reqProcessValidationHelper.FinishApiCall(appResponse);
                });
                appResponse.on('end', function () {
                    reqProcessValidationHelper.FinishApiCall(appResponse);
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
                reqProcessValidationHelper.Validate(params, headers, objLogInfo, function (error, result, info) {
                    try {
                        if (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, error.ERROR_CODE, error.ERROR_MESSAGE, error.ERROR);
                        } else if (info) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, '', '', '', 'FAILURE', info);
                        } else {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, result, objLogInfo);
                        }
                    } catch (error) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-VAL-120002', 'Error in reqProcessValidationHelper.Validate callback', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-VAL-120003', 'Error in reqLogInfo.AssignLogInfoDetail callback', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, '', null, 'ERR-VAL-120004', 'Error in ProcessValidation callback', error);
    }
});

module.exports = router;
/********* End of Service *********/