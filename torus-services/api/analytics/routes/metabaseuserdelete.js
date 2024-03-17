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
var reqInstanceHelper =require('../../../../torus-references/common/InstanceHelper');

// Initialize Global variables

var strResult = '';
var strMessage = '';

var router = express.Router();

// Host the login api
router.post('/metabaseuserdelete', function(appReq, appResp) {

    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
        reqLogWriter.Eventinsert(objLogInfo);
        objLogInfo.PROCESS = 'metabaseuserdelete-Analytics';
        objLogInfo.ACTION = 'metabaseuserdelete';
    
        var strHeader = {};
        
            
                strHeader = { 'routingkey': 'METABASE' }
        try {
            var params = appReq.body;
            
    
        
            var id = params.PARAMS;
            console.log(id);
            
            reqTranDBInstance.GetTranDBConn(strHeader,false,function callbackGetTranDB(pSession){
            reqTranDBInstance.UpdateTranDBWithAudit(pSession, 'core_user', {
                is_active:false
            }, {
                email:id
            }, objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
            if (pError)
            _SendResponse({},'Errcode','Error while update Programs Table',pError,null );
            else
            _SendResponse('SUCCESS','','',null,null );
            
            })
            })
    
    
            //Connecting to Postgres "ide_project_info" table.
            //var PGSession = yield PGInstanceHelper.PrepareInstances(postgresConfig);
    
            //var select_project = "update al_tran.project_connections set project_id=?,redis_key=?,user_id=? where id=?";
    
            //var Projects = yield PGInstanceHelper.ExecutePostGresqlQuery(PGSession, select_project, [appReq.body.project, appReq.body.connections,appReq.body.user,appReq.body.id], true);
    
    
            //PGInstanceHelper.DestroyInstance(PGSession);
            //appResp.send(JSON.stringify({ 'statuscode': '100', 'status_message': 'SUCCESS' }));
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