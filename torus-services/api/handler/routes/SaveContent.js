/*
@Api_Name           : /SaveContent,
@Description        : To Save the attachment in trn_attachments against a transaction
@Last_Error_code    : ERR-HAN-40626 
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqCommon = require('./helper/Common');
var reqSaveContent = require('../../../../torus-references/transaction/SaveContent');
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');

var strServiceName = 'SaveContent'

// API hosting
router.post('/SaveContent', function(appRequest, appResponse, next) {
    var objLogInfo = ''
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function(pLogInfo, session_info) {
            objLogInfo = pLogInfo;

            // Handle the close event when client close the connection 
            appResponse.on('close', function() {});
            appResponse.on('finish', function() {});
            appResponse.on('end', function() {});

            _PrintInfo('Begin');
            objLogInfo.HANDLER_CODE = 'ADD_CONTENT'

            // Initialize local variables
            var strInputParamJson = appRequest.body.PARAMS;
            var jparse = appRequest.body.PARAMS;
            var pDtCode = jparse.DT_CODE
            jparse.APP_ID = session_info.APP_ID
            jparse.LOGIN_NAME = session_info.LOGIN_NAME
            jparse.APPSTS_ID = session_info.APPSTS_ID
            jparse.SYSTEM_DESC = session_info.SYSTEM_DESC
            jparse.SYSTEM_ID = session_info.SYSTEM_ID
            jparse.USER_ID = session_info.U_ID
            jparse.USER_NAME = session_info.USER_NAME;
            jparse.objLogInfo = objLogInfo;
            _PrintInfo('ScanSaveContent function params Assigned');
            reqSaveContent.ScanSaveContent(jparse, appRequest, '', function(pResult) {
                if (pResult.STATUS != undefined && pResult.STATUS == 'FAILURE') {
                    _PrintInfo('SaveContent function Ended... With Failure');
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, pResult.ERROR_CODE, pResult.ERROR_MESSAGE, pResult.ERROR_OBJECT);
                } else {
                    reqInsHelper.SendResponse(strServiceName, appResponse, pResult, objLogInfo, null, null, null);
                }
            });
        });
    } catch (error) {
        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40626', 'Error in SaveContent function', null);
    }

    // Print Log information
    function _PrintInfo(pMessage) {
        reqInsHelper.PrintInfo(strServiceName, pMessage, objLogInfo)
    }
});

module.exports = router;
/************* End of Service **********/