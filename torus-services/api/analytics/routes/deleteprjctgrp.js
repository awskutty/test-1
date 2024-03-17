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
// Initialize Global variables

var strResult = '';
var strMessage = '';

var router = express.Router();

// Host the login api
router.post('/deleteprjctgrp', function (appReq, appResp) {
    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {

        reqLogWriter.Eventinsert(objLogInfo);
        objLogInfo.PROCESS = 'deleteprjctgrp-Analytics';
        objLogInfo.ACTION = 'deleteprjctgrp';

        var strHeader = appReq.headers
          var params = appReq.body;
          reqAnalyticInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {
              try {
                var params = appReq.body;
                var Group_Name = params.GROUP_NAME;
                var Program_Id = params.PROGRAM_ID;
                var Project_Id = params.PROJECT_ID;

                reqAnalyticInstance.DeleteTranDB(pSession, 'PROGRAM_GROUP', {
                  PROJECT_ID: Project_Id,
                  GROUP_NAME: Group_Name,
                  PROGRAM_ID: Program_Id
                }, objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
                      if (pError) {
                          _SendResponse({}, 'Errcode', 'Unable To delete program from group', pError, null);
                      }
                      else{
                          _SendResponse({SUCCESS:'Program removed from group Successfully'}, '', '','',null);
                      }
                })
              } catch (error) {
                  _SendResponse({}, 'Errcode', 'Unable To delete program from group', error, null);
              }
        })
        // To send the app response
        function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
            var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
            var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
            return reqInstanceHelper.SendResponse('deleteprjctgrp', appResp, ResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
        }
        function errorHandler(errcode, message) {
            console.log(errcode, message);
            reqLogWriter.TraceError(objLogInfo, message, errcode);
        }
})});
module.exports = router;
