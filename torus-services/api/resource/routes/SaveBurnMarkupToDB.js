/*
    @Api_Name           : /SaveBurnMarkupToDB,
    @Description        : To Save markup changes to database
    @Last Error Code    : ERR-RES-71612
	@Last Changes		:
*/

// Require dependencies
var reqExpress = require('express');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqCommon = require('./helper/Common');
var router = reqExpress.Router();
var reqSaveBurnMarkupToDBHelper = require('./helper/SaveBurnMarkupToDBHelper');
var serviceName = 'SaveBurnMarkupToDB';
var objLogInfo = '';

// Host api to server
router.post('/SaveBurnMarkupToDB', function (appRequest, appResponse, pNext) {
    var objLogInfo;
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            try {
                objLogInfo.HANDLER_CODE = 'SAVE_BURN_MARKUP_TO_DB';
                // Handle the close event when client closes the api request
                appResponse.on('close', function () { // This will call unexpected close from client
                    reqSaveBurnMarkupToDBHelper.FinishApiCall(appResponse);
                });
                appResponse.on('finish', function () {
                    reqSaveBurnMarkupToDBHelper.FinishApiCall(appResponse);
                });
                appResponse.on('end', function () {
                    reqSaveBurnMarkupToDBHelper.FinishApiCall(appResponse);
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
                reqSaveBurnMarkupToDBHelper.SaveBurnMarkupToDB(params, headers, appRequest.method, objLogInfo, function (error, result, info) {
                    try {
                        if (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, error.ERROR_CODE, error.ERROR_MESSAGE, error.ERROR);
                        } else if (info) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, '', '', '', 'FAILURE', info);
                        } else {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, result, objLogInfo);
                        }
                    } catch (error) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-RES-71602', 'Error in reqSaveBurnMarkupToDBHelper.SaveBurnMarkupToDB callback', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-RES-71603', 'Error in reqLogInfo.AssignLogInfoDetail callback', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-RES-71604', 'Error in SaveBurnMarkupToDB callback', error);
    }
});

module.exports = router;
/********* End of Service *********/