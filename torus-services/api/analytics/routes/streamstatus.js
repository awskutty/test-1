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
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper')

// Initialize Global variables

var strResult = '';
var strMessage = '';

var router = express.Router();

// Host the login api
router.post('/streamstatus', function(appReq, appResp) {
    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
        
    reqLogWriter.Eventinsert(objLogInfo);
    objLogInfo.PROCESS = 'streamstatus-Analytics';
    objLogInfo.ACTION = 'streamstatus';
    var strHeader = {};
   
    try {
        
        var params = appReq.body;
        var prg_name=params.PROJNAME
        var project_id=params.PROJECT_ID
        reqAnalyticInstance.GetTranDBConn(strHeader,false,function callbackGetTranDB(pSession){
            reqAnalyticInstance.GetTableFromTranDB(pSession, 'PROGRAM_GROUP_FLOW_LOG', 
            { "program_name": prg_name,"project_id":project_id }, objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
                if (pError)
                    _SendResponse({}, 'Errcode', 'Error while update Programs Table', pError, null);
                else
                    _SendResponse({pResult}, '', '', null, null);

            })
        

        })
       
        function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
            var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
            var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
            return reqInstanceHelper.SendResponse('ChangeSearchTag', appResp, ResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
        }
            function errorHandler(errcode, message) {
                console.log(errcode, message);
                reqLogWriter.TraceError(objLogInfo, message, errcode);
            }
    
    
    } catch (error) {
        _SendResponse({},'Errcode','Error Unable To Load Group',error,null );
    }

    })
    
    

});
module.exports = router;