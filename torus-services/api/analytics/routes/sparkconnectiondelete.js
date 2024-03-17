/****
 * Api_Name          : /Upload,
 * Description       : ,
 * Last_Error_Code   : ERR-ANL-5100
 ****/

// Require dependencies
var modPath = '../../../../node_modules/'
var express = require(modPath + 'express');
var reqTranDBInstance = require('../../../../torus-references/instance/AnalyticInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var redisInstance= require('../../../../torus-references/instance/RedisInstance.js');
var reqInstanceHelper =require('../../../../torus-references/common/InstanceHelper');

// Initialize Global variables
var strResult = '';
var strMessage = '';

var router = express.Router();

// Host the login api
router.post('/sparkconnectiondelete', function(appReq, appResp) {

    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
        reqLogWriter.Eventinsert(objLogInfo);
    
        objLogInfo.PROCESS = 'sparkconnectiondelete-Analytics';
        objLogInfo.ACTION = 'sparkconnectiondelete';
        
        try {
            redisInstance.GetRedisConnection(function (error, clientR) {
                if(error){
                    _SendResponse({},'Errcode','Error while update Programs Table',error,null );
                }
                else{
                    var redis_key_name="spark_"+appReq.body.spark_app_name
             clientR.del(redis_key_name, function (err, keys) {
            if (err)
            { _SendResponse({},'Errcode','Error while update Programs Table',err,null );
            }
            else{
                reqTranDBInstance.GetTranDBConn(strHeader,false,function callbackGetTranDB(pSession){
                    
                     
                     reqTranDBInstance.DeleteTranDB(pSession, 'project_connections', {
                         redis_key:redis_key_name
                     }, objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
                     if (pError)
                     _SendResponse({},'Errcode','Error while update Programs Table',pError,null );
                     else
                     _SendResponse('SUCCESS','','',null,null );
                     
                     })
                     })
            }
        
        
          });
                }
                })
        } catch (error) {
            errorHandler("ERR-FX-10021", "Error APLogin function ERR-001 " + error)
        }
    
        function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
            var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
            var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
            return reqInstanceHelper.SendResponse('ChangeSearchTag', appResp, ResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
            }
            function errorHandler(errcode, message) {
            console.log(errcode, message);
            reqLogWriter.TraceError(objLogInfo, message, errcode);
            }
    });


    })
   
module.exports = router;