/*
    @Api_Name           : /SaveAnnotation,
    @Description        : To save the annotation changes to database
    @Last Error Code    : ERR-RES-71511
*/

// Require dependencies
var reqExpress = require('express');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqCommon = require('./helper/Common');
var router = reqExpress.Router();
var serviceName = 'SaveAnnotation';

// Host api to server
router.post('/SaveAnnotation', function(appRequest, appResponse) {

    var objLogInfo;
    try {
        var reqSaveAnnotationHelper = require('./helper/SaveAnnotationHelper');
        reqLogInfo.AssignLogInfoDetail(appRequest, function(objLogInfo, objSessionInfo) {
            try {
                objLogInfo.HANDLER_CODE = 'SAVE_TRAN'; // correct it
                // Handle the close event when client closes the api request
                appResponse.on('close', function() { // This will call unexpected close from client
                    reqSaveAnnotationHelper.FinishApiCall(appResponse);
                    reqLogWriter.EventUpdate(objLogInfo);
                });
                appResponse.on('finish', function() {
                    reqSaveAnnotationHelper.FinishApiCall(appResponse);
                });
                appResponse.on('end', function() {
                    reqSaveAnnotationHelper.FinishApiCall(appResponse);
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
                reqSaveAnnotationHelper.SaveAnnotation(params, headers, objLogInfo, function(error, result, info) {
                    try {
                        if (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, error.ERROR_CODE, error.ERROR_MESSAGE, error.ERROR);
                        } else if (info) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, '', '', '', 'FAILURE', info);
                        } else {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, result, objLogInfo);
                        }
                    } catch (error) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-RES-71502', 'Error in reqSaveAnnotationHelper.SaveAnnotation callback', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-RES-71503', 'Error in reqLogInfo.AssignLogInfoDetail callback', error);
            }
        });

    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-RES-71504', 'Error in SaveAnnotation callback', error);
    }
});

module.exports = router;
/********* End of Service *********/