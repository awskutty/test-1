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
router.post('/runflow', function(appReq, appResp) {
    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {

        reqLogWriter.Eventinsert(objLogInfo);
        objLogInfo.PROCESS = 'runflow-Analytics';
        objLogInfo.ACTION = 'runflow';
        var strHeader = {};
      
        
   
        try {
            var params = appReq.body;
            var Project_Id=params.PROJ_ID;
            var Runflow_name=params.RUNFLOW_NAME;
            
            var Select_Runflow="Select p.id,p.ide_project_name,p.ide_project_type,p.ide_project_code,p.project_info_json,p.ide_project_version,pgf.sequence_no as PGF_SEQ_NO,pg.sequence_no as PG_sequence_no,pgf.flow_name,pg.group_name from programs p Inner Join program_group pg on p.ide_project_code = pg.program_id Inner Join program_group_flow pgf on pgf.group_name = pg.group_name Where pgf.project_id='"+Project_Id+ "'and pgf.flow_name='"+Runflow_name+"'order by PGF_SEQ_NO,pg.sequence_no,pg.sequence_no "
    
            reqAnalyticInstance.GetTranDBConn(strHeader,false,function callbackGetTranDB(pSession){
              try {
                reqAnalyticInstance.ExecuteSQLQuery(pSession,Select_Runflow,objLogInfo,
                    function callbackTransactionSetUpdate(pResult, pError){
                  try {
                    if(pError){
                        _SendResponse({}, 'Errcode', 'ERROR Not Load', pError, null);
                    }
                    else{
                        var result=pResult.rows
                        _SendResponse({ result }, null, '', null, null);
                    } 
                  } catch (error) {
                    _SendResponse({}, 'Errcode', 'Unable To Load Run Flow', error, null);
                  }
                    })
              } catch (error) {
                _SendResponse({}, 'Errcode', 'Unable To Load Run Flow', error, null);
              }
            })
          
        
          // Use the mv() method to place the file somewhere on your server
         
        } catch (error) {
            _SendResponse({}, 'Errcode', 'Unable To Load Run Flow', pError, null);
        }
        function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
            var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS'
            var ResponseData = (pResponseData == null || pResponseData == undefined) ? '' : pResponseData
            return reqInstanceHelper.SendResponse('ChangeSearchTag', appResp, ResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning)
        }
    })

    
    
  
});
module.exports = router;