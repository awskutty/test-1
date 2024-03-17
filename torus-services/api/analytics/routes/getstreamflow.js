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
router.post('/getstreamflow', function(appReq, appResp) {
    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
        
    reqLogWriter.Eventinsert(objLogInfo);
    objLogInfo.PROCESS = 'getstreamflow-Analytics';
    objLogInfo.ACTION = 'getstreamflow';
    var strHeader = {};

    
    try {  
        var params = appReq.body;
        var project_id=params.PROJECT_ID    
        var select_pid="Select pgfl.program_name,(CASE WHEN LENGTH(pgfl.process_id) > 0 THEN true ELSE false END) buttonDisabled from program_group_flow_log pgfl join programs p on p.ide_project_name = pgfl.program_name where pgfl.project_id='"+project_id+"'"
        reqAnalyticInstance.GetTranDBConn(strHeader,false,function callbackGetTranDB(pSession){
            reqAnalyticInstance.ExecuteSQLQuery(pSession, select_pid, 
             objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
                if (pError)
                    _SendResponse({},'Errcode', 'Error while Getting Information', pError, null);
                else
                    _SendResponse({pResult}, '', '', null, null);

            })
        

        })
       
        function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
            var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
            var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
            return reqInstanceHelper.SendResponse('ChangeSearchTag', appResp, ResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
        }
          
    
    
    } catch (error) {
        _SendResponse({},'Errcode','Error while Getting Process ID',error,null );
    }

    })
    
    

});
module.exports = router;