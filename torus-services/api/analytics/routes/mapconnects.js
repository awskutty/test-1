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
router.post('/mapconnects', function(appReq, appResp) {

    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
        reqLogWriter.Eventinsert(objLogInfo);

        objLogInfo.PROCESS = 'mapconnects-Analytics';
        objLogInfo.ACTION = 'mapconnects';
        var strHeader = {};
        if(appReq.headers && appReq.headers.routingkey){
            strHeader = appReq.headers;
            }
            else{
            strHeader={'routingkey':'CLT-0~APP-0~TNT-0~ENV-0'}
            }
        
        try {
           
            var params = appReq.body;
            appResp.setHeader('Content-Type', 'application/json');
            // Initialize local variables
            var params = appReq.body;
           
           var query;
           if(appReq.body.db_type=='rdbms'){
            query="DELETE FROM project_connections where redis_key LIKE ('%rdbms%') and project_id="+appReq.body.project+" and user_id = '"+objLogInfo.USER_ID+"'";
           }
           else if(appReq.body.db_type=='cassandra'){
            query="DELETE FROM project_connections where redis_key LIKE ('%cassandra%') and project_id="+appReq.body.project+" and user_id = '"+objLogInfo.USER_ID+"'";
           }
           else if(appReq.body.db_type=='kafka'){
            query="DELETE FROM project_connections where redis_key LIKE ('%kafka%') and project_id="+appReq.body.project+" and user_id = '"+objLogInfo.USER_ID+"'";
                       }
                       else if(appReq.body.db_type=='spark'){
                        query="DELETE FROM project_connections where redis_key LIKE ('%spark%') and project_id="+appReq.body.project+" and user_id = '"+objLogInfo.USER_ID+"'";
                                   }
                                   else{

                                   }
                        
            

          
       
    
            reqTranDBInstance.GetTranDBConn(strHeader,false,function callbackGetTranDB(pSession){

                reqTranDBInstance.ExecuteSQLQuery(pSession, query, objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
                    if (pError){
                        _SendResponse({},'Errcode','Error while update Programs Table',pError,null );
                    }
                    
                    else{
                       
                var rowarray=[];
                for(var i=0;i<appReq.body.connections.length;i++){
                    rowarray.push({
                        project_id: appReq.body.project,
                        redis_key:appReq.body.connections[i],
                        user_id:appReq.body.user
                    });
                }
                console.log(rowarray);
                reqTranDBInstance.InsertBulkTranDB(pSession, 'project_connections', rowarray, objLogInfo,null, function callbackTransactionSetUpdate(pResult, pError) {
                if (pError)
                _SendResponse({},'Errcode','Error while update Programs Table',pError,null );
                else
                _SendResponse('SUCCESS','','',null,null );
                
                })
                    }
                   
                    
                    })

                })
    
    
    
    
            //Connecting to Postgres "ide_project_info" table.
            //var PGSession = yield PGInstanceHelper.PrepareInstances(postgresConfig);
            //var select_project = "insert into al_tran.project_connections(project_id,redis_key,user_id) values(?,?,?)";
    
           //for(var i=0;i<appReq.body.connections.length;i++){
               // var Projects = yield PGInstanceHelper.ExecutePostGresqlQuery(PGSession, select_project, [appReq.body.project, appReq.body.connections[i],appReq.body.user], true);
           //}
    
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