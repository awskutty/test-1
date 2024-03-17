/*
    @Api_Name           : /AnnotationCheckIn,
    @Description        : To get file data form fx db
    @Last Error Code    : 'ERR-RES-71812'
*/

// Require dependencies
var reqExpress = require('express');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqCommon = require('./helper/Common');
var reqAnnotationCheckInHelper = require('./helper/AnnotationCheckInHelper');
var router = reqExpress.Router();
var serviceName = 'AnnotationCheckIn';


// Host api to server
router.post('/AnnotationCheckIn', function(appRequest, appResponse) {
    var objLogInfo = "";
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function(objLogInfo, objSessionInfo) {
            try {
                objLogInfo.HANDLER_CODE = 'DO_ANNOTATION_CHECK_IN';
                // Handle the close event when client closes the api request
                appResponse.on('close', function() { // This will call unexpected close from client
                    reqAnnotationCheckInHelper.FinishApiCall(appResponse);
                });
                appResponse.on('finish', function() {
                    reqAnnotationCheckInHelper.FinishApiCall(appResponse);
                });
                appResponse.on('end', function() {
                    reqAnnotationCheckInHelper.FinishApiCall(appResponse);
                });
                reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
                var params = appRequest.body;
                var headers = appRequest.headers;
                var Fileparams = appRequest.files;
                var sessionInfoKeys = Object.keys(objSessionInfo);
                // This loop is for merge session values with params
                for (var i = 0; i < sessionInfoKeys.length; i++) {
                    var currentKey = sessionInfoKeys[i];
                    params[currentKey] = objSessionInfo[currentKey];
                }
                // Call hepler class function
                reqAnnotationCheckInHelper.DoAnnotationChkIn(params, headers, Fileparams, objLogInfo, function(error, result, info) {
                    try {
                        if (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, error.ERROR_CODE, error.ERROR_MESSAGE, error.ERROR);
                        } else if (info) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, '', '', '', 'FAILURE', info);
                        } else {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, result, objLogInfo);
                        }
                    } catch (error) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-RES-71802', 'Error in reqAnnotationCheckInHelper.DoAnnotationChkIn callback', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-RES-71803', 'Error in reqLogInfo.AssignLogInfoDetail callback', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-RES-71804', 'Error in AnnotationCheckIn callback', error);
    }
});

module.exports = router;
/********* End of Service *********/