/*
@Api_Name : /SaveAppUserSTSRole,
@Description: To save asigned and unassigned system
*/

// Require dependencies
var node_modules = '../../../../node_modules/'
var referenceRoot = '../../../../torus-references'
var reqExpress = require(node_modules + 'express')
var router = reqExpress.Router()
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqLinq = require(node_modules + 'node-linq').LINQ;
var async = require(node_modules + 'async');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
const { resolve } = require('path');
var strServiceName = 'SaveAppUserSTSRole';
// Host the SaveAppUserSTSRole api
router.post('/SaveAppUserSTSRole', function (appRequest, appResponse, next) {
    var objLogInfo = '';

    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
            var mHeaders = appRequest.headers;           
            var U_ID = objSessionInfo.U_ID;

            reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, async function CallbackGetCassandraConn(pCltClient) {
                var mClient = pCltClient;
                // Initialize local variables  
                var strAppuId = appRequest.body.PARAMS.APPU_ID;
                var strUId = U_ID;
                var strAppstsId = appRequest.body.PARAMS.APPSTS_ID;              
                var arrASTSID = [];
                arrASTSID = strAppstsId.split(',');
                var appuserstsID = '';              
               // Delete all assigned Systems 
                delAppUserSTS();

                function delAppUserSTS() {
                    reqInstanceHelper.PrintInfo(strServiceName, 'Deleting app_user_sts table', objLogInfo);
                    reqFXDBInstance.DeleteFXDB(mClient, 'app_user_sts', { 'appu_id': strAppuId }, objLogInfo, async function callbacksave(err, res) {
                        try {
                            if (err) {
                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51457', 'Exception Occured while deleting appusersts function', err, '', '');
                            } else {
                                // Insert Already Assigned and New Assigning systems for every assign
                                for (var i = 0; i < arrASTSID.length; i++) {
                                    await updateFX_total_items();
                                    var appusersts = await getFX_total_items();
                                    await insertappusts(appusersts, arrASTSID[i]);

                                }
                                reqInstanceHelper.PrintInfo(strServiceName, 'Syatem Assigned/Unassigned successfully', objLogInfo);
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', 'SUCCESS', '');
                            }

                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51457', 'Exception Occured while executing saveAppUserSTS function ', error, '', '');
                        }

                    })
                }


                function updateFX_total_items() {
                    return new Promise((resolve, reject) => {
                        try {
                            var code = 'APP_USER_STS'
                            var selectquery = {
                                query: `update fx_total_items set counter_value = counter_value + 1 where code=?`,
                                params: [code]
                            }
                            reqInstanceHelper.PrintInfo(strServiceName, 'Updating fx_total_items table', objLogInfo);
                            reqFXDBInstance.ExecuteSQLQueryWithParams(mClient, selectquery, objLogInfo, function (pResult, pError) {
                                if (pError) {
                                    reject(pError)
                                } else {
                                    resolve('SUCCESS')
                                }
                            })
                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51457', 'Exception Occured while executing  appusersts table insert process ', error, '', '');
                        }
                    })
                }

                function getFX_total_items() {
                    return new Promise((resolve, reject) => {
                        try {
                            var squery = {
                                query: `select counter_value from fx_total_items where code = ?`,
                                params: ['APP_USER_STS']
                            }
                            reqInstanceHelper.PrintInfo(strServiceName, 'Querying fx_total_items table', objLogInfo);
                            reqFXDBInstance.ExecuteSQLQueryWithParams(mClient, squery, objLogInfo, function (Result, Error) {
                                if (Error) {
                                    reject(Error);
                                } else {
                                    var appustsID = Result.rows[0].counter_value;
                                    resolve(appustsID);
                                }
                            })
                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51457', 'Exception Occured while executing  appusersts table insert process ', error, '', '');
                        }
                    })
                }

                function insertappusts(appuserstsID, appstsId) {
                    return new Promise((resolve, reject) => {
                        try {
                            reqInstanceHelper.PrintInfo(strServiceName, 'Inserting app_user_sts table', objLogInfo);
                            reqFXDBInstance.InsertFXDB(mClient, 'app_user_sts', [{
                                'appu_id': strAppuId,
                                'appusts_id': appuserstsID,
                                'appsts_id': appstsId,
                                'created_by': strUId,
                                'created_date': reqDateFormater.GetTenantCurrentDateTime(mHeaders, objLogInfo)
                            }], objLogInfo, function (error, result) {
                                if (result) {
                                    resolve('SUCCESS')
                                }
                                else {
                                    reject(error)
                                }
                            })
                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51457', 'Exception Occured while executing  appusersts table insert process ', error, '', '');
                        }
                    })
                }




            })
        })
    } catch (error) {
        return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51457', 'Exception Occured while executing  SaveAppUserSTSRole function ', error, '', '');
    }
});
module.exports = router;