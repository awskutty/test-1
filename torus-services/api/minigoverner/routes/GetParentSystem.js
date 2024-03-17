
/*
@Api_Name           :   /GetParentSystem,
@Description        :   To get parent system
@Last_Error_code    :   ERR-MIN-50403
*/

// Require dependencies
var node_modules = '../../../../node_modules/'
var referenceRoot = '../../../../torus-references'
var reqExpress = require(node_modules + 'express')
var router = reqExpress.Router()
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqLINQ = require(node_modules + "node-linq").LINQ;
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

var serviceName = "GetParentSystem";

// Host the api
router.post('/GetParentSystem', function (appRequest, appResponse, pNext) {

    var objLogInfo;
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)

        objLogInfo.HANDLER_CODE = 'GET_PARENTSYSTEM'
        objLogInfo.PROCESS = 'GetParentSystem-Minigoverner';
        objLogInfo.ACTION_DESC = 'GetParentSystem';

        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });

        var mResinfo = new GetSTS();
        try {
            var mHeaders = appRequest.headers;
            reqInstanceHelper.PrintInfo(serviceName, 'Getting FXDBConnection', objLogInfo)
            reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                var mCltClient = pCltClient;
                // Initialize Global variables
                var Client_id = objSessionInfo.CLIENT_ID;
                var stID = appRequest.body.PARAMS.ST_ID;
                var cond = {}

                if (stID != '' && stID != undefined) {
                    cond.st_id=stID;
                    cond.client_id = Client_id
                } else { }

                reqInstanceHelper.PrintInfo(serviceName, 'Querying system_to_system table', objLogInfo)
                reqFXDBInstance.GetTableFromFXDB(mCltClient, 'systems', ['s_id', 's_description'], cond, objLogInfo, function callbackgetsyst(error, result) {
                    try {
                        if (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-MIN-50401', 'Error occured whilefetching data from system_to_system', error)
                        } else {
                            var arrRes = [];
                            for (var i = 0; i < result.rows.length; i++) {
                                var obj = {};
                                var pRow = result.rows[i];
                                obj.CHILD_S_DESCRIPTION = pRow.s_description;
                                obj.S_ID = pRow.s_id;
                                arrRes.push(obj);
                            }

                            var orderbysys = new reqLINQ(arrRes)
                                .OrderBy(function (v) {
                                    return v.CHILD_S_DESCRIPTION
                                })
                            mResinfo.STS = orderbysys.items;
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, mResinfo, objLogInfo, null, null, null)
                        }
                    } catch (error) {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-MIN-50402', 'Exception occured', error)
                    }
                })
            });
        } catch (error) {
            return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-MIN-50403', 'Exception occured', error)
        }

        function GetSTS() {
            var STS = [];
        }
    });
});


module.exports = router;
/******** End of Service *****/