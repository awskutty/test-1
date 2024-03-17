/*
@Api_Name               :   /AppSTSSearch,
@Description            :   To Search STS for an App
@Last_Error_code        :   ERR-MIN-51204
*/

// Require dependencies
var node_modules = '../../../../node_modules/'
var referenceRoot = '../../../../torus-references'
var reqExpress = require(node_modules + 'express')
var router = reqExpress.Router()

var reqLinq = require(node_modules + "node-linq").LINQ;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

var serviceName = "AppSTSSearch";

// Host the api
router.post('/AppSTSSearch', function (appRequest, appResponse, pNext) {
    var objLogInfo;
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)

        objLogInfo.HANDLER_CODE = 'APP_STSSEARCH';
        objLogInfo.PROCESS = 'AppSTSSearch-Minigoverner';
        objLogInfo.ACTION_DESC = 'AppSTSSearch';

        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });
        try {
            var mHeaders = appRequest.headers;
            reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {

                //Initialize local variables
                var mCltClient = pCltClient;
                var strClientId = objSessionInfo.CLIENT_ID;
                var strSearchSysName = appRequest.body.PARAMS.SEARCH_APPSYS_NAME;
                var strAppId = objSessionInfo.APP_ID;
                var strAllocatedAppUserSTS = appRequest.body.PARAMS.ALLOCATED_APPUSTS;
                var issearch = appRequest.body.PARAMS.IS_SEARCH;

                var GetSearchRes = '';
                var sbAPPSts = {};
                var APP_SYSTEM_TO_SYSTEM = [];
                reqInstanceHelper.PrintInfo(serviceName, 'Calling AppSystoSysSearch method', objLogInfo)
                AppSystoSysSearch(function (response) {
                    if (response.STATUS === "SUCCESS") {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, response.SUCCESS_DATA, objLogInfo, null, null, null)
                    } else {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, response.ERROR_CODE, response.ERROR_MESSAGE, response.ERROR_OBJECT)
                    }
                })

                // App system to System Search
                function AppSystoSysSearch(callback) {
                    try {
                        var lstallocatedsys = [];
                        var usys = strAllocatedAppUserSTS.split(",");
                        for (var i = 0; i < usys.length; i++) {
                            if (!lstallocatedsys.indexOf(usys[i]) >= 0)
                                lstallocatedsys.push(usys[i]);
                        }
                        reqInstanceHelper.PrintInfo(serviceName, 'Querying app_system_to_system table', objLogInfo)
                        reqFXDBInstance.GetTableFromFXDB(mCltClient, 'app_system_to_system', ['s_description', 's_id', 's_code', 'appsts_id', 'cluster_code'], {
                            'app_id': strAppId
                        }, objLogInfo, function callbackGetTableFromFXDB(error, result) {
                            try {
                                if (error) {
                                    callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51201', 'Error while querying app_system_to_system table', error))
                                } else {
                                    if (issearch == 'Y') {
                                        GetSearchRes = new reqLinq(result.rows)
                                            .Where(function (u) {
                                                return u.s_description.toUpperCase().startsWith(strSearchSysName.toUpperCase())
                                            }).ToArray();
                                    } else {
                                        GetSearchRes = result.rows;
                                    }

                                    function arrUnique(arr) {
                                        var cleaned = [];
                                        arr.forEach(function (itm) {
                                            if (itm.cluster_code) {
                                                var unique = true;
                                                cleaned.forEach(function (itm2) {
                                                    if (itm.s_code === itm2.s_code && itm.cluster_code === itm2.cluster_code) unique = false;
                                                });
                                                if (unique) cleaned.push(itm);
                                            }
                                        });
                                        return cleaned;
                                    }
                                    GetSearchRes = arrUnique(GetSearchRes);

                                    for (var k = 0; k < GetSearchRes.length; k++) {
                                        var obj = {};
                                        var arraylst = [];
                                        if (lstallocatedsys.indexOf(GetSearchRes[k].appsts_id) < 0) {
                                            obj.APPSTS_ID = GetSearchRes[k].appsts_id;
                                            obj.CLUSTER_CODE = GetSearchRes[k].cluster_code;
                                            obj.S_ID = GetSearchRes[k].s_id;
                                            obj.S_DESCRIPTION = GetSearchRes[k].s_description;
                                            obj.s_code = GetSearchRes[k].s_code;
                                            APP_SYSTEM_TO_SYSTEM.push(obj);
                                        }
                                    }

                                    sbAPPSts.APP_SYSTEM_TO_SYSTEM = APP_SYSTEM_TO_SYSTEM;
                                    callback(sendMethodResponse("SUCCESS", '', sbAPPSts, '', '', ''))
                                }
                            } catch (error) {
                                callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51202', 'Exception occured', error))
                            }
                        })
                    } catch (error) {
                        callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51203', 'Exception occured', error))
                    }
                }
            });
        } catch (error) {
            callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51204', 'Exception occured', error))
        }
    });
});

// Method to prepare response object
function sendMethodResponse(status, successMessage, SuccessDataObj, errorCode, errorMessage, errorObject) {
    var obj = {
        'STATUS': status,
        'SUCCESS_MESSAGE': successMessage,
        'SUCCESS_DATA': SuccessDataObj,
        'ERROR_CODE': errorCode,
        'ERROR_MESSAGE': errorMessage,
        'ERROR_OBJECT': errorObject
    }
    return obj
}

module.exports = router;
/******** End of Service *****/