/*
@Api_Name           :   /SaveAssignedAppSTS,
@Description        :   To save assigned STS App
@Last_Error_code    :   ERR-MIN-51317
*/

// Require dependencies
var node_modules = '../../../../node_modules/'
var referenceRoot = '../../../../torus-references'
var reqExpress = require(node_modules + 'express')
var router = reqExpress.Router()
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');

const TOTALAPPSTS = 'update fx_total_items set counter_value = counter_value + 1 where code=\'APP_SYSTEM_TO_SYSTEM\'';
const TOTALAPPST = 'update fx_total_items set counter_value = counter_value + 1 where code=\'APP_SYSTEM_TYPES\'';
var serviceName = "SaveAssignedAppSTS"

// Host the api
router.post('/SaveAssignedAppSTS', function (appRequest, appResponse, pNext) {
    var objLogInfo;
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {

        objLogInfo.HANDLER_CODE = 'SAVE_ASSIGNED_APP_STS'
        objLogInfo.PROCESS = 'SaveAssignedAppSTS-Minigoverner';
        objLogInfo.ACTION_DESC = 'SaveAssignedAppSTS';

        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });

        try {
            var mHeaders = appRequest.headers;
            reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)
            reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                var mCltClient = pCltClient;

                //Initialize local variables
                var Client_id = objSessionInfo.CLIENT_ID;
                var AssignedSystems = appRequest.body.PARAMS.ASSIGNED_APPSTS;
                var Totalsyscount = AssignedSystems.APP_SYSTEMS.length;
                var pApp_id = objSessionInfo.APP_ID;
                var pUSER_ID = objSessionInfo.U_ID;
                var UNIQ_APPSTS_ID = '';
                var UNIQ_APPST_ID = '';
                var resinfo = 'FAIL';
                var count = 0;

                reqInstanceHelper.PrintInfo(serviceName, 'Calling saveAssignedAppSTS', objLogInfo)
                SaveAssignedAppSTS(AssignedSystems.APP_SYSTEMS.shift(), function (response) {
                    if (response.STATUS === "SUCCESS") {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, response.SUCCESS_DATA, objLogInfo, null, null, null)
                    } else {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, response.ERROR_CODE, response.ERROR_MESSAGE, response.ERROR_OBJECT)
                    }
                })

                // Method to save assigned app
                function SaveAssignedAppSTS(Systeminfo, callback) {
                    var sys_sts = Systeminfo;
                    var pSt_id = '';
                    var pS_code = '';
                    reqFXDBInstance.GetTableFromFXDB(mCltClient, 'systems', ['st_id', 's_code'], {
                        's_id': sys_sts.CHILD_S_ID
                    }, objLogInfo, function callbacksys(error, result) {
                        try {
                            if (error) {
                                callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51301', 'Error querying systems table', error))
                            } else {
                                var sys_val = result.rows;
                                pSt_id = sys_val[0].st_id;
                                pS_code = sys_val[0].s_code;
                                reqInstanceHelper.PrintInfo(serviceName, 'Executing TOTALAPPSTS Query', objLogInfo)
                                reqFXDBInstance.ExecuteQuery(mCltClient, TOTALAPPSTS, objLogInfo, function callbacktotapp(error) {
                                    try {
                                        if (error) {
                                            callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51302', 'Error executing TOTALAPPSTS', error))
                                        } else {
                                            reqFXDBInstance.GetTableFromFXDB(mCltClient, 'fx_total_items', ['counter_value'], {
                                                'code': 'APP_SYSTEM_TO_SYSTEM'
                                            }, objLogInfo, function callbackappsts(error, result) {
                                                try {
                                                    if (error) {
                                                        callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51303', 'Error querying fx_total_items', error))
                                                    } else {
                                                        UNIQ_APPSTS_ID = result.rows[0].counter_value.toString();
                                                        getSTCode(pSt_id, function (res) {
                                                            reqInstanceHelper.PrintInfo(serviceName, 'Executing insert query for app_system_to_system table', objLogInfo)
                                                            reqFXDBInstance.InsertFXDB(mCltClient, 'app_system_to_system', [{
                                                                'appsts_id': UNIQ_APPSTS_ID,
                                                                'app_id': pApp_id,
                                                                'cluster_code': sys_sts.CLUSTER_CODE,
                                                                'child_s_id': sys_sts.CHILD_S_ID,
                                                                'parent_s_id': sys_sts.PARENT_S_ID,
                                                                's_description': sys_sts.S_DESCRIPTION,
                                                                's_id': sys_sts.CHILD_S_ID,
                                                                'st_id': pSt_id,
                                                                'st_code': res.st_code,
                                                                'sts_id': sys_sts.STS_ID,
                                                                'created_by': pUSER_ID,
                                                                'created_date': reqDateFormater.GetTenantCurrentDateTime(mHeaders, objLogInfo),
                                                                's_code': pS_code
                                                            }], objLogInfo, function callbackpappsts(error) {
                                                                try {
                                                                    if (error) {
                                                                        callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51304', 'Error inserting data to app_system_to_system', error))
                                                                    } else {
                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Executing TOTALAPPST query', objLogInfo)
                                                                        reqFXDBInstance.ExecuteQuery(mCltClient, TOTALAPPST, objLogInfo, function callbacktotapp(error) {
                                                                            try {
                                                                                if (error) {
                                                                                    callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51305', 'Error in TOTALAPPST Query', error))
                                                                                } else {
                                                                                    reqFXDBInstance.GetTableFromFXDB(mCltClient, 'fx_total_items', ['counter_value'], {
                                                                                        'code': 'APP_SYSTEM_TYPES'
                                                                                    }, objLogInfo, function callbackappstt(error, rest) {
                                                                                        try {
                                                                                            if (error) {
                                                                                                callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51306', 'Error executing fx_total_items query', error))
                                                                                            } else {
                                                                                                UNIQ_APPST_ID = rest.rows[0].counter_value.toString();
                                                                                                reqFXDBInstance.GetTableFromFXDB(mCltClient, 'system_types', ['st_description'], {
                                                                                                    'st_id': pSt_id
                                                                                                }, objLogInfo, function callbackSysType(error, reslt) {
                                                                                                    try {
                                                                                                        if (error) {
                                                                                                            callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51307', 'Error querying system_types', error))
                                                                                                        } else {
                                                                                                            var St_description = '';
                                                                                                            St_description = reslt.rows[0].st_description;
                                                                                                            reqInstanceHelper.PrintInfo(serviceName, 'Executing insert query on app_system_types', objLogInfo)
                                                                                                            reqFXDBInstance.InsertFXDB(mCltClient, 'app_system_types', [{
                                                                                                                'appst_id': UNIQ_APPST_ID,
                                                                                                                'app_id': pApp_id,
                                                                                                                'st_description': St_description,
                                                                                                                'st_id': pSt_id,
                                                                                                                'created_by': pUSER_ID,
                                                                                                                'created_date': reqDateFormater.GetTenantCurrentDateTime(mHeaders, objLogInfo),
                                                                                                            }], objLogInfo, function callbackinsapps(error) {
                                                                                                                try {
                                                                                                                    if (error) {
                                                                                                                        callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51308', 'Error inserting to app_system_types', error))
                                                                                                                    } else {
                                                                                                                        resinfo = JSON.stringify('SUCCESS');
                                                                                                                        count = count + 1;
                                                                                                                        if (count == Totalsyscount) {
                                                                                                                            callback(sendMethodResponse("SUCCESS", '', '', '', '', ''))
                                                                                                                        } else {
                                                                                                                            SaveAssignedAppSTS(AssignedSystems.APP_SYSTEMS.shift(), callback);
                                                                                                                        }
                                                                                                                    }
                                                                                                                } catch (error) {
                                                                                                                    callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51309', 'Exception occured', error))
                                                                                                                }
                                                                                                            })
                                                                                                        }
                                                                                                    } catch (error) {
                                                                                                        callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51310', 'Exception occured', error))
                                                                                                    }
                                                                                                })
                                                                                            }
                                                                                        } catch (error) {
                                                                                            callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51311', 'Exception occured', error))
                                                                                        }
                                                                                    })
                                                                                }
                                                                            } catch (error) {
                                                                                callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51312', 'Exception occured', error))
                                                                            }
                                                                        })
                                                                    }
                                                                } catch (error) {
                                                                    callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51313', 'Exception occured', error))
                                                                }
                                                            })

                                                        })
                                                    }
                                                } catch (error) {
                                                    callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51314', 'Exception occured', error))
                                                }
                                            })
                                        }
                                    } catch (error) {
                                        callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51315', 'Exception occured', error))
                                    }
                                })
                            }

                            // to get system type code 
                            function getSTCode(pStId, pcallback) {
                                try {
                                    reqDBInstance.GetTableFromFXDB(mCltClient, 'system_types', ['st_code'], {
                                        'st_id': pStId
                                    }, objLogInfo, function (pErr, pRes) {
                                        if (pErr) {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50514', 'Querying system_types table have been Failed', pErr, '', '');
                                        } else {
                                            if (pRes.rows.length) {
                                                pcallback(pRes.rows[0])
                                            } else {
                                                reqInstanceHelper.PrintInfo(strServiceName, 'system type code not found for this st_id ' + pStId, objLogInfo);
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50525', 'System type entry not found', 'System type entry not found', '', '');
                                            }
                                        }
                                    })
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50543', 'Exception ocuured in getSTCode', error, '', '');
                                }
                            }

                        } catch (error) {
                            callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51316', 'Exception occured', error))
                        }
                    })

                }
            });
        } catch (error) {
            callback(sendMethodResponse("FAILURE", '', '', 'ERR-MIN-51317', 'Exception occured', error))
        }
    });
});

// Method to form response object
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
//*******End of Service*******//