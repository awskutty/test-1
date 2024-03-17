/*
    @Api_Name           : /BindVersionAttachments,
    @Description        : To get file data form fx db
    @Last Error Code    : 'ERR-RES-71920'
*/

// Require dependencies
var reqExpress = require('express');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqBindVersionAttachmentsHelper = require('./helper/BindVersionAttachmentsHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqCommon = require('./helper/Common');
var router = reqExpress.Router();
var serviceName = 'BindVersionAttachments';

// Host api to server
router.post('/BindVersionAttachments', function(appRequest, appResponse) {
    var objLogInfo;
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function(objLogInfo, objSessionInfo) {
            try {
                objLogInfo.HANDLER_CODE = 'BIND_VERSION_ATTACHMENTS';
                // Handle the close event when client closes the api request
                appResponse.on('close', function() { // This will call unexpected close from client
                    reqBindVersionAttachmentsHelper.FinishApiCall(appResponse);
                });
                appResponse.on('finish', function() {
                    reqBindVersionAttachmentsHelper.FinishApiCall(appResponse);
                });
                appResponse.on('end', function() {
                    reqBindVersionAttachmentsHelper.FinishApiCall(appResponse);
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
                reqBindVersionAttachmentsHelper.BindVersionAttachments(params, headers, objLogInfo, function(error, result, info) {
                    try {
                        if (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, error.ERROR_CODE, error.ERROR_MESSAGE, error.ERROR);
                        } else if (info) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, '', '', '', 'FAILURE', info);
                        } else {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, result, objLogInfo);
                        }
                    } catch (error) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-RES-71902', 'Error in reqHelper.BindVersionAttachments callback', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-RES-71903', 'Error in reqLogInfo.AssignLogInfoDetail callback', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-RES-71904', 'Error in BindVersionAttachments callback', error);
    }
});

module.exports = router;
/********* End of Service *********/