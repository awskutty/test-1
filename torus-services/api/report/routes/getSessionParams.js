/*@Api_Name : /GetRolesWorkflow,
@Description: To GetRolesWorkflow
@Last_Error_code:'ERR-MIN-50604
*/



// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

var async = require('async');

var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');

//global variable Initialization
var strServiceName = "GetReportSessionParams";


// Host the method to express
router.post('/getReportSessionParams', function (appRequest, appResponse) {
    var objLogInfo;
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            reqInstanceHelper.PrintInfo(strServiceName, 'Service Begined Successfully', objLogInfo);
            objLogInfo.HANDLER_CODE = 'GetReportSessionParams';
            objLogInfo.PROCESS = 'GetReportSessionParams-Report';
            objLogInfo.ACTION_DESC = 'GetReportSessionParams';
            var mHeaders = appRequest.headers;
            mCltClient = ''

            getSessionParams()

            function getSessionParams() {
                try {

                    reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                        mCltClient = pCltClient;
                        reqFXDBInstance.GetTableFromFXDBNoCache(mCltClient, 'code_descriptions', ['code_value'], {
                            cd_code: 'QUERY_PARAMS'
                        }, objLogInfo, function calbackGetTableFromFXDB(error, result) {
                            try {
                                if (error) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-MIN-51883', 'Error in DesignerInfo function', error);
                                } else {
                                    if (result.rows.length) {
                                        var SessionParams = result.rows;
                                        reqInstanceHelper.PrintInfo(strServiceName, 'Got session report params. ', objLogInfo);
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, SessionParams, objLogInfo);
                                    } else {
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, '', '', null, 'FAILURE', 'No Designer info found');
                                    }
                                }
                            } catch (error) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-MIN-90522', 'Exception occured GetReportSessionParams callback function', error);
                            }
                        });
                    })
                } catch (error) {
                    reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-MIN-90521', 'Exception occured getsessionparams function', error);
                }
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-90520', 'Error in GetReportSessionParams API function', error, '', '');
    }
    appResponse.on('close', function () {});
    appResponse.on('finish', function () {});
    appResponse.on('end', function () {});
});


module.exports = router;
/*********** End of Service **********/