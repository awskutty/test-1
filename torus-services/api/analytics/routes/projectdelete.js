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
var reqInstanceHelper =require('../../../../torus-references/common/InstanceHelper')

// Initialize Global variables
var strResult = '';
var strMessage = '';

var router = express.Router();

// Host the login api
router.post('/projectdelete', function (appReq, appResp) {

    reqLogInfo.AssignLogInfoDetail(appReq, function (objLogInfo, objSessionInfo) {
        reqLogWriter.Eventinsert(objLogInfo);
        objLogInfo.PROCESS = 'projectdelete-Analytics';
        objLogInfo.ACTION = 'projectdelete';
        var strHeader = {};
        if (appReq.headers && appReq.headers.routingkey) {
            strHeader = appReq.headers;
        }
        else {
            strHeader = { 'routingkey': 'CLT-0~APP-0~TNT-0~ENV-0' }
        }

        try {
            var params = appReq.body;
            appResp.setHeader('Content-Type', 'application/json');
            // Initialize local variables
            var params = appReq.body;
            var id = appReq.body.projectid;
            



            reqTranDBInstance.GetTranDBConn(strHeader, false, function callbackGetTranDB(pSession) {
                reqTranDBInstance.DeleteTranDB(pSession, 'projects', {
                    id: id
                }, objLogInfo, function callbackTransactionSetUpdate(pResult, pError) {
                    if (pError){
                        _SendResponse({}, 'Errcode', 'Error while update Programs Table', pError, null);
                    }
                       
                    else{
                        _SendResponse(pResult, '', '', null, null);
                    }
                      

                })
            })


            //Connecting to Postgres "ide_project_info" table.
            //var PGSession = yield PGInstanceHelper.PrepareInstances(postgresConfig);
            //var select_project = "insert into al_tran.projects(project_name,project_description,user_id,app_id,s_id,client_id,appu_id,cluster_code) values(?,?,?,?,?,?,?,?)";
            //var Projects = yield PGInstanceHelper.ExecutePostGresqlQuery(PGSession, select_project, [appReq.body[0].Projectname, appReq.body[0].Projectdescription, appReq.body[0].userid, appReq.body[0].appid, appReq.body[0].systemid, appReq.body[0].clientid, appReq.body[0].appuid, appReq.body[0].clustercode], true);
            //PGInstanceHelper.DestroyInstance(PGSession);
            //appResp.send(JSON.stringify({ 'statuscode': '100', 'status_message': 'SUCCESS', 'datas': Projects }));
        } catch (error) {
            errorHandler("ERR-FX-10021", "Error APLogin function ERR-001 " + error)
        }

        // To send the app response
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

});
module.exports = router;