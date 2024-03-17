/*  Created BY      :Udhaya
    Created Date    :24-jun-2016
    pupose          :LoadClusters in wp  
    @Api_Name : /LoadMinigovernerTab,
    @Description: To LoadMinigovernerTab
    @Last_Error_code:ERR-MIN-50903
      */

// Require dependencies
var modPath = '../../../../node_modules/';
var reqExpress = require(modPath + 'express');
var router = reqExpress.Router();
var reqLINQ = require(modPath + "node-linq").LINQ;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');

//Global variable Initialization
var strServiceName = "LoadMinigovernerTab";


//host the method to express
router.post('/LoadMinigovernerTab', function (appRequest, appResponse) {
    var objLogInfo;
    var params = appRequest.body.PARAMS;

    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            reqInstanceHelper.PrintInfo(strServiceName, 'Service Begined Successfully', objLogInfo);
            objLogInfo.HANDLER_CODE = 'LoadMinigovernerTab';
            objLogInfo.PROCESS = 'LoadMinigovernerTab-MiniGoverner';
            objLogInfo.ACTION_DESC = 'LoadMinigovernerTab';
            var mHeaders = appRequest.headers;
            var Loadsetup = params.Loadsetup;



            reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                reqInstanceHelper.PrintInfo(strServiceName, 'Cassandra Connection Initiated Successfully', objLogInfo);
                var mClient = pCltClient;
                var strAppID = sessionInfo.APP_ID;
                var strClientID = sessionInfo.CLIENT_ID;

                //Function call
                reqInstanceHelper.PrintInfo(strServiceName, 'Calling LoadMinigovernerTab Function', objLogInfo);
                LoadMinigovernerTab();

                //Prepare Function
                function LoadMinigovernerTab() {
                    reqInstanceHelper.PrintInfo(strServiceName, 'FX_SETUP_MASTER', objLogInfo);
                    var cond = {};
                    cond.setup_code = Loadsetup; //['MINIGOVERNER_TAB_ACCESS_PRIVILLAGE'];
                    reqsvchelper.GetSetupJson(mClient, cond, objLogInfo, function (res, error) {
                        if (error) {
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-59001', 'Error in Querying fx_setup_master table', error, '', '');
                        } else {
                            reqInstanceHelper.PrintInfo(strServiceName, 'Got result fx_setup_master from table', objLogInfo);
                            var APSTSrows = res;
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, APSTSrows, objLogInfo, '', '', '', 'SUCCESS', '');

                        }
                    });
                }
            });
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-59002', 'Error while calling Loadmingovernersetup API function', error, '', '');
        //errorHandler("ERR-FX-10314", "Error in LoadClusters function " + error)
    }

    appResponse.on('close', function () { });
    appResponse.on('finish', function () { });
    appResponse.on('end', function () { });

});
module.exports = router;
//*******End of Serive*******//