/**
 * Api_Name         : /SearchReport
 * Description      : To Search the shared report for current app user and app roles
 * Last ErrorCode   : ERR-RPT-60725
 **/

// Require dependencies
var modPath = '../../../../node_modules/';
var refPath = '../../../../torus-references/';
var reqExpress = require(modPath + 'express');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');
var Reporthelper = require('./ServiceHelper/ReportHelper');
var router = reqExpress.Router();

// Host the api
router.post('/SearchReport', function (appRequest, appResponse) {

    var objLogInfo = '';

    try {
        var Params = appRequest.body.PARAMS;
        var strReqHeader = appRequest.headers;

        reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, pSessionInfo) {

            objLogInfo = pLogInfo;
            objLogInfo.HANDLER_CODE = 'SearchReport';

            reqInsHelper.PrintInfo('SearchReport', 'Begin', objLogInfo);

            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });

            Reporthelper.SearchReport(Params, pSessionInfo, strReqHeader, objLogInfo, function (pRes) {
                if (pRes) {
                    if (pRes.JasperAuth) {
                        try {
                            var jasperAuthRes = pRes.JasperAuth.headers['set-cookie'];
                            console.log('cookie length |' +pRes.JasperAuth.headers['set-cookie'].length)
                            for (var i = 0; i < jasperAuthRes.length; i++) {
                                appResponse.cookie(jasperAuthRes[i]);
                            }

                        } catch (error) {
                            reqInsHelper.PrintInfo('SearchReport', 'Exception occured' + error, objLogInfo);
                        }
                    } else {
                        reqInsHelper.PrintInfo('SearchReport', 'Jasper server not authenticated ', objLogInfo);
                    }
                    return _SendResponse(pRes.Data, pRes.ErrorCode, pRes.ErrorMsg, pRes.Error, pRes.Warning);
                }
            });
        });
    } catch (error) {
        return _SendResponse(null, 'ERR-RPT-60701', 'Error on Error in SearchReport API', error, null);
    }

    // To send the app response
    function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
        var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS';
        var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData;
        return reqInsHelper.SendResponse('SearchReport', appResponse, ResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning);
    }
});

module.exports = router;
/*********** End of Service **********/