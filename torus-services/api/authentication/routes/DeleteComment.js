/*
 * @Api_Name : /DeleteComment
 * @Description: To get language dictionary
 * @Last_Error_code:ERR-AUT-110999
 */

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

// Global variable initialization 
var serviceName = 'DeleteComment';

// Host api to server
router.post('/DeleteComment', function (appRequest, appResponse, next) {
    var objLogInfo;
    try {
        var reqCommentHelper = require('./helper/CommentHelper');
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            try {
                // Handle the api close event from when client close the request
                appResponse.on('close', function () { });
                appResponse.on('finish', function () { });
                appResponse.on('end', function () { });
                //objLogInfo.HANDLER_CODE = 'DeleteComment';
                reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
                var params = appRequest.body.PARAMS;
                var headers = appRequest.headers;
                var sessionInfoKeys = Object.keys(objSessionInfo);
                // This loop is for merge session values with params
                for (var i = 0; i < sessionInfoKeys.length; i++) {
                    var currentKey = sessionInfoKeys[i];
                    params[currentKey] = objSessionInfo[currentKey];
                }
                reqCommentHelper.DeleteComment(params, headers, objLogInfo, function (error, result) {
                    try {
                        if (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errcode', 'errmsg', error);
                        } else {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, result, objLogInfo);
                        }
                    } catch (error) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errcode', 'errmsg', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errcode', 'errmsg', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'errcode', 'errmsg', error);
    }
});

module.exports = router;
// End function