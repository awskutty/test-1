// Require dependencies 
var reqExpress = require('express');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var router = reqExpress.Router();
var serviceName = "DeleteDownloadedFiles";

router.post('/DeleteDownloadedFiles', function (appRequest, appResponse) {
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        try {
            var mHeaders = appRequest.headers;
            var inputRequest = appRequest.body.PARAMS;
            var fileName = inputRequest.FileName;
            var conditon = {
                "FILE_NAME": fileName,
                "APP_ID": objLogInfo.APP_ID,
                "TENANT_ID": objLogInfo.TENANT_ID
            }
            reqTranDBInstance.GetTranDBConn(mHeaders, false, function (pSession) {
                reqTranDBInstance.DeleteTranDB(pSession, "ex_header_files", conditon, objLogInfo, function (pResult, pError) {
                    if (pError) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, "FAILED", objLogInfo, 'ERR-EXC-10000', 'Error occured delete records from table ', pError);
                    } else {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, "SUCCESS", objLogInfo, '', '', '');
                    }
                })
            })
        } catch (error) {
            return reqInstanceHelper.SendResponse(serviceName, appResponse, "FAILED", objLogInfo, 'ERR-EXC-10000', 'Exception Occured While Calling ImportFile API ... ', error);
        }
    })
})

module.exports = router;