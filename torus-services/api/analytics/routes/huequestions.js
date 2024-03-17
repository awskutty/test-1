/****
 * Api_Name          : /Upload,
 * Description       : ,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var modPath = '../../../../node_modules/'
var express = require(modPath + 'express');
var reqTranDBInstance = require('../../../../torus-references/instance/AnalyticInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper =require('../../../../torus-references/common/InstanceHelper');

// Initialize Global variables

var strResult = '';
var strMessage = '';

var router = express.Router();

// Host the login api
router.post('/huequestions', function(appReq, appResp) {
    
        reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
            reqLogWriter.Eventinsert(objLogInfo);
            objLogInfo.PROCESS = 'huequestions-Analytics';
            objLogInfo.ACTION = 'huequestions';
            var strHeader = {};
        
            
                strHeader = { 'routingkey': 'HUE' }
            
        
            var query = "select * from desktop_document2 where tap_projectid="+appReq.body.projectid+";"
        
            try {
                reqTranDBInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {
                  reqTranDBInstance.ExecuteSQLQuery(pSession, query, objLogInfo, function callback(res, err) {
                    if (err) {
                        _SendResponse({}, 'ERR-ANL-111105', 'Error selecting from project_queries Table', err, null,objLogInfo);
                    }
                    else {
                        _SendResponse(res.rows,'', '', null, null,objLogInfo);
                    }
                  })
                })
              } catch (error) {
                errorHandler("ERR-ANL-111105", "Error in getting trandb function in datasourceconfig" + error)
              }
            });
          // To send the app response
          function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning,pobjLogInfo) {
            var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
            var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
            return reqInstanceHelper.SendResponse('ChangeSearchTag', appResp, ResponseData, pobjLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
          }
        
          function errorHandler(errcode, message) {
            console.log(errcode, message);
            reqLogWriter.TraceError(objLogInfo, message, errcode);
          }
        });
   
module.exports = router;