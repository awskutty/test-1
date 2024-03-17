/*
@Api_Name           :       /GetSystemParams,
@Description        :       To get system params
@Last_Error_code    :       ERR-MIN-50307
*/

// Require dependencies
var node_modules = '../../../../node_modules/'
var referenceRoot = '../../../../torus-references'
var reqExpress = require(node_modules + 'express')
var router = reqExpress.Router()
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqFXDBInstance =require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

var serviceName = "GetSystemParams";

// Host the api
router.post('/GetSystemParams', function(appRequest, appResponse, pNext) {
    var objLogInfo;
    reqLogInfo.AssignLogInfoDetail(appRequest, function(objLogInfo, objSessionInfo) {
        reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)

        objLogInfo.HANDLER_CODE = 'GET_SYSTEMPARAMS'
        objLogInfo.PROCESS = 'GetSystemParams-Minigoverner';
        objLogInfo.ACTION_DESC = 'GetSystemParams';

        appResponse.on('close', function() {});
        appResponse.on('finish', function() {});
        appResponse.on('end', function() {});

        try {
            var mHeaders = appRequest.headers;
            reqInstanceHelper.PrintInfo(serviceName, 'Getting FXDB COnnection', objLogInfo)
            reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                var mCltClient = pCltClient;
                appResponse.setHeader('Content-Type', 'application/json');

                // Initialize Global variables
                var Client_id = objSessionInfo.CLIENT_ID;
                var sbCluster = '';
                var sbWFT = '';
                var resinfo = new resultinfo();
                var i = 0;
                var j = 0;
                reqInstanceHelper.PrintInfo(serviceName, 'Calling GetSysType method', objLogInfo)
                GetSysType(Client_id, function(response) {
                    if (response.STATUS === "SUCCESS") {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, response.SUCCESS_DATA, objLogInfo, null, null, null)
                    } else {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, respone.ERROR_CODE, response.ERROR_MESSAGE, response.ERROR_OBJECT)
                    }
                });

                // To get sys type
                function GetSysType(Client_id, callback) {
                    try {
                        reqFXDBInstance.GetTableFromFXDB(mCltClient, 'system_types', ['st_id', 'st_code', 'st_description'], {
                            'client_id': Client_id
                        }, objLogInfo, function callbackgetsyst(error, result) {
                            try {
                                if (error) {
                                    callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50307', 'Exception occured', error))
                                } else {
                                    i = i + 1;
                                    if (i > 1) {
                                        resinfo.SYS_TYPE.push(",");
                                    }
                                    var arrRest = [];
                                    for (var i = 0; i < result.rows.length; i++) {
                                        var obj = {};
                                        var pRow = result.rows;
                                        obj.ST_ID = pRow[i].st_id;
                                        obj.ST_CODE = pRow[i].st_code;
                                        obj.ST_DESCRIPTION = pRow[i].st_description;
                                        arrRest.push(obj);
                                        resinfo.SYS_TYPE = arrRest;
                                    }
                                    reqInstanceHelper.PrintInfo(serviceName, 'Calling GetClustInfo method', objLogInfo)
                                    GetClustInfo(Client_id, function(response) {
                                        callback(response);
                                    });
                                }
                            } catch (error) {
                                callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50305', 'Exception occured', error))
                            }
                        })
                    } catch (error) {
                        callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50306', 'Exception occured', error))
                    }
                }

                //Prepare the cluster info
                function GetClustInfo(Client_id, callback) {
                    try {
                        reqFXDBInstance.GetTableFromFXDB(mCltClient, 'clusters', ['client_id', 'cluster_code', 'cluster_name'], {
                            'client_id': Client_id
                        }, objLogInfo, function callbackgetsyst(error, result) {
                            try {
                                if (error) {
                                    callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50301', 'Error while fetching data from clusters table', error))
                                } else {
                                    j = j + 1;
                                    if (j > 1) {
                                        resinfo.SYS_TYPE.push(",");
                                    }
                                    var arrRes = [];
                                    for (var i = 0; i < result.rows.length; i++) {
                                        var obj = {};
                                        var pRow = result.rows;
                                        obj.CLUSTER_CODE = pRow[i].cluster_code;
                                        obj.CLUSTER_NAME = pRow[i].cluster_name;
                                        arrRes.push(obj);
                                        resinfo.CLUSTERS = arrRes;
                                    }
                                    callback(sendMethodResponse("SUCCESS", '', resinfo, '', '', ''))
                                }
                            } catch (error) {
                                callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50302', 'Exception occured', error))
                            }
                        })
                    } catch (error) {
                        callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50303', 'Exception occured', error))
                    }
                }
            });
        } catch (error) {
            callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-50304', 'Exception occured', error))
        }


        //Prepare the object function for system type
        function resultinfo() {
            var CLUSTERS = [];
            var SYS_TYPE = [];
        }
    });

});

//Method to form response object
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