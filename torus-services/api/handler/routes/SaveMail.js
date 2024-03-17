/*
    @Api_Name           : /SaveMail,
    @Description        : To move email data to transaction DB target table
    @Last Error Code    : 'ERR-HAN-43536'
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqCommon = require('./helper/Common');
var serviceName = 'SaveMail';

// Host api to server
router.post('/SaveMail', function(appRequest, appResponse) {
    var objLogInfo;
    try {
        var reqSaveMailHelper = require('./helper/SaveMailHelper');
        reqLogInfo.AssignLogInfoDetail(appRequest, function(objLogInfo, objSessionInfo) {
            try {
                objLogInfo.HANDLER_CODE = 'SaveMail'; //correct it
                appResponse.on('close', function() {
                    reqSaveMailHelper.FinishApiCall(appResponse);
                    reqLogWriter.EventUpdate(objLogInfo);
                });
                appResponse.on('finish', function() {
                    reqSaveMailHelper.FinishApiCall(appResponse);
                });
                appResponse.on('end', function() {
                    reqSaveMailHelper.FinishApiCall(appResponse);
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
                reqSaveMailHelper.SaveMail(params, headers, objLogInfo, function(error, result, info) {
                    try {
                        if (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-HAN-43501', 'Error in reqSaveMailHelper.SaveMail callback', error);
                        } else if (info) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, '', '', '', 'FAILURE', info);
                        } else {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, result, objLogInfo);
                        }
                    } catch (error) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-HAN-43502', 'Error in reqSaveMailHelper.SaveMail callback', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-HAN-43536', 'Error in reqLogInfo.AssignLogInfoDetail callback', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, '', null, 'ERR-HAN-43503', 'Error in SaveMail function', error);
    }
});

module.exports = router;
/********* End of Service *********/