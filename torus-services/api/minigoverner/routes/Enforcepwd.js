var node_modules = '../../../../node_modules/'
var reqExpress = require(node_modules + 'express')
var router = reqExpress.Router()
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

var serviceName = "Enforcepwd";

// Host the api
router.post('/Enforcepwd', function (appRequest, appResponse, pNext) {
    var objLogInfo;
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)

        objLogInfo.HANDLER_CODE = 'Enforcepwd'
        objLogInfo.PROCESS = 'Enforcepwd';
        objLogInfo.ACTION_DESC = 'Enforcepwd';

        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });

        try {
            var mHeaders = appRequest.headers;
            reqInstanceHelper.PrintInfo(serviceName, 'Getting FXDB COnnection', objLogInfo)
            reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                var mCltClient = pCltClient;
                appResponse.setHeader('Content-Type', 'application/json');


                var strInputParam = appRequest.body.PARAMS;
                //var resinfo = new resultinfo();
                reqInstanceHelper.PrintInfo(serviceName, 'Calling password log ', objLogInfo);
                reqFXDBInstance.GetTableFromFXDB(mCltClient, 'user_password_log', [], {
                    'u_id': strInputParam.UID
                }, objLogInfo, function callbackgetsyst(error, result) {
                    try {
                        if (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Error Ocuured Get System table ', pError, '', '');
                        } else {
                            var data = {};
                            data.Enforcepwd = "N"
                            if (result.rows.length >= 2) {
                                data.Enforcepwd = "Y"
                            }
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, data, objLogInfo, null, null, null)
                        }
                    } catch (error) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured Get System table', error, '', '');
                    }
                });
            })
        } catch (error) {
            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured while GetFXDBConnection ', error, '', '');
        }
    })
})

module.exports = router;