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
router.post('/loadGroupflow', function(appReq, appResp) {
    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
        
    reqLogWriter.Eventinsert(objLogInfo);
    objLogInfo.PROCESS = 'loadGroupflow-Analytics';
    objLogInfo.ACTION = 'loadGroupflow';
    var strHeader = {};
   
    try {
        
        // Initialize local variables
        //var Select_Group="select distinct group_name from program_group where project_id=?";
        var params = appReq.body;
        var Project_Id = params.PROJECT_ID;
        var Select_Group_Flow="select distinct flow_name from program_group_flow where project_id="+Project_Id+"";
        reqAnalyticInstance.GetTranDBConn(strHeader,false,function callbackGetTranDB(pSession){
         try {
        
            reqAnalyticInstance.ExecuteSQLQuery(pSession, Select_Group_Flow,objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
             try {
                if(pError){
                    _SendResponse({},'Errcode','Error In Getting Group_Flow',pError,null );
                }
                else{
                    var result=pResult
                    _SendResponse({resultdata: result }, null, '', '', null);
                }
             } catch (error) {
                _SendResponse({},'Errcode','Error Unable To Load Group_Flow',error,null );
             }

            })
         } catch (error) {
            _SendResponse({},'Errcode','Error Unable To Load Group_Flow',error,null );
         }

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
        _SendResponse({},'Errcode','Error Unable To Load Group',pError,null );
    }

    })
    
    

});
module.exports = router;