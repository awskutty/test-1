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
router.post('/projects', function(appReq, appResp) {
    console.log(appReq.body);
    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
        reqLogWriter.Eventinsert(objLogInfo);
        objLogInfo.PROCESS = 'projects-Analytics';
        objLogInfo.ACTION = 'projects';
        var strHeader = {};
        if(appReq.headers && appReq.headers.routingkey){
            strHeader = appReq.headers;
            }
            else{
            strHeader={'routingkey':'CLT-0~APP-0~TNT-0~ENV-0'}
            }
    
    
        
        try {
    
    
    
            reqTranDBInstance.GetTranDBConn(strHeader,false,function callbackGetTranDB(pSession){
                reqTranDBInstance.GetTableFromTranDB(pSession, 'projects', {"user_id":appReq.body.userid}, objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
                if (pError)
                _SendResponse({},'Errcode','Error while update Programs Table',pError,null );
                else
                _SendResponse(pResult,'','',null,null );
                
                })
                })
          
    
    
    
    
           // var params = appReq.body;
            //var project_id = params.PROJECT_ID;
            //Connecting to Postgres "ide_project_info" table.
           // var PGSession = yield PGInstanceHelper.PrepareInstances(postgresConfig);
           // var select_project = "select * from projects";
           // var Projects = yield PGInstanceHelper.ExecutePostGresqlQuery(PGSession, select_project, [], true);
           // PGInstanceHelper.DestroyInstance(PGSession);
           // appResp.send(JSON.stringify({ 'statuscode': '100', 'status_message': 'SUCCESS', 'datas': Projects.rows }));
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