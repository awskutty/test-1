/****
 * Api_Name          : /Upload,
 * Description       : ,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var modPath = '../../../../node_modules/'
var express = require(modPath + 'express');
var reqAnalyticInstance = require('../../../../torus-references/instance/AnalyticInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqRequest = require(modPath + 'request');
// Initialize Global variables

var strResult = '';
var strMessage = '';

var router = express.Router();

// Host the login api
router.post('/deletegrpflw', function (appReq, appResp) {
    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {

        reqLogWriter.Eventinsert(objLogInfo);
        objLogInfo.PROCESS = 'deletegrpflw-Analytics';
        objLogInfo.ACTION = 'deletegrpflw';

        var strHeader = appReq.headers
          var params = appReq.body;
          reqAnalyticInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {
              try {
                var params = appReq.body;
                var Group_Name = params.GROUP_NAME;
                var Flow_Name = params.FLOW_NAME;
                var Project_Id = params.PROJECT_ID;

                reqAnalyticInstance.DeleteTranDB(pSession, 'PROGRAM_GROUP_FLOW', {
                  PROJECT_ID: Project_Id,
                  GROUP_NAME: Group_Name,
                  FLOW_NAME: Flow_Name
                }, objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
                      if (pError) {
                          _SendResponse({}, 'Errcode', 'Unable To delete Group from groupflow', pError, null);
                      }
                      else{
                          _SendResponse({SUCCESS:'Group removed from groupflow Successfully'}, '', '','',null);
                      }
                })
              } catch (error) {
                  _SendResponse({}, 'Errcode', 'Unable To delete Group from groupflow', error, null);
              }
        })
        // To send the app response
        function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
            var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
            var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
            return reqInstanceHelper.SendResponse('deletegrpflw', appResp, ResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
        }
        function errorHandler(errcode, message) {
            console.log(errcode, message);
            reqLogWriter.TraceError(objLogInfo, message, errcode);
        }
})});
module.exports = router;
