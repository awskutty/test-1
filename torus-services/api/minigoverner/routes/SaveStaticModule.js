/*@Api_Name : /GetRolesWorkflow,
@Description: To GetRolesWorkflow
@Last_Error_code:'ERR-MIN-50604
*/



// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
const WFTEMP = 'select app_id,wft_code,wft_description from wf_templates where app_id=?';
const ROLESRW = 'select appr_id,role_code,role_description from app_roles where app_id=?';


var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');

//global variable Initialization
var strServiceName = "SaveStaticModules";


// Host the method to express
router.post('/SaveStaticModules', function (appRequest, appResponse) {
    var objLogInfo;
    var resultinfo = new resultinf();
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            reqInstanceHelper.PrintInfo(strServiceName, 'Service Begined Successfully', objLogInfo);
            objLogInfo.HANDLER_CODE = 'SaveStaticModules';
            objLogInfo.PROCESS = 'SaveStaticModules-MiniGoverner';
            objLogInfo.ACTION_DESC = 'SaveStaticModules';
            var mHeaders = appRequest.headers;
            var RoleId = appRequest.body.PARAMS.ROLEID || '';
            var StaticModules = appRequest.body.PARAMS.StaticModules || '';
            reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                var mCltClient = pCltClient;

                getStaticModules()



                function getStaticModules() {
                    try {
                        var cond = {
                            "APPR_ID": RoleId,
                        }
                        reqFXDBInstance.GetTableFromFXDB(mCltClient, 'APP_ROLE_STATIC_MODULE', [], cond, objLogInfo, function callbackapproles(err, result) {
                            if (err) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-80923', 'Querying APP_ROLE_STATIC_MODULE table have been Failed', err, '', '');
                            } else {
                                if (result.rows.length > 0) {
                                    reqInstanceHelper.PrintInfo(strServiceName, 'Get modules in APP_ROLE_STATIC_MODULE table Now we can update the values', objLogInfo)
                                    // reqInstanceHelper.SendResponse(strServiceName, appResponse, 'Static Modules Saved Successfully', objLogInfo, '', '', '', '', '');
                                    updateStaticModules()
                                } else {
                                    insertStaticModules()
                                }

                            }
                        })



                    } catch (error) {
                        // reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-80922', 'Error in GetAllocatedStaticModule API function', error, '', '');
                    }

                }

                function updateStaticModules() {
                    // reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {

                    var insertRow = {
                        "STATIC_MODULE": JSON.stringify(StaticModules)
                    }
                    var updatecond = {
                        "APPR_ID": RoleId
                    }
                    reqFXDBInstance.UpdateFXDB(mCltClient, 'APP_ROLE_STATIC_MODULE', insertRow, updatecond, objLogInfo, function callbackapproles(err, result) {
                        if (err) {
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-80924', 'Updating static modules in APP_ROLE_STATIC_MODULE table have been Failed', err, '', '');
                        } else {
                            var arresult = [];
                            reqInstanceHelper.PrintInfo(strServiceName, 'Updated Successfully', objLogInfo);
                            // reqInstanceHelper.PrintInfo(strServiceName, 'Resul::' + JSON.stringify(resultinfo), objLogInfo);
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, 'Updated Successfully', objLogInfo, '', '', '', '', '');
                        }
                    })


                    // });
                }

                function insertStaticModules() {
                    // reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                    // reqInstanceHelper.PrintInfo(strServiceName, ' clt_cas Cassandra Connection Initiated Successfully', objLogInfo);
                    // var mCltClient = pCltClient;
                    var insertRow = {
                        "APPR_ID": RoleId,
                        "STATIC_MODULE": JSON.stringify(StaticModules),
                        "CREATED_BY": objLogInfo.USER_ID,
                        "CREATED_DATE": reqDateFormater.GetTenantCurrentDateTime(mHeaders, objLogInfo)
                    }
                    reqFXDBInstance.InsertFXDB(mCltClient, 'APP_ROLE_STATIC_MODULE', [insertRow], objLogInfo, function callbackapproles(err, result) {
                        if (err) {
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-80921', 'Querying app_roles table have been Failed', err, '', '');
                        } else {
                            var arresult = [];
                            reqInstanceHelper.PrintInfo(strServiceName, 'insert Successfully', objLogInfo);
                            // var approl = result.rows;
                            // for (var i = 0; i < result.rows.length; i++) {
                            //     var obj = {};
                            //     obj.APPR_ID = approl[i].appr_id;
                            //     obj.ROLE_CODE = approl[i].role_code;
                            //     obj.ROLE_DESCRIPTION = approl[i].role_description;
                            //     arresult.push(obj);
                            //     resultinfo.ROLES = arresult;
                            // }
                            reqInstanceHelper.PrintInfo(strServiceName, 'Resul::' + JSON.stringify(resultinfo), objLogInfo);
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, 'Static Modules Saved Successfully', objLogInfo, '', '', '', '', '');
                        }
                    })


                    // });
                }

            })
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-80922', 'Error in GetAllocatedStaticModule API function', error, '', '');

    }


    function resultinf() {
        var WFT = [];
        var ROLES = [];
    }

    appResponse.on('close', function () {});
    appResponse.on('finish', function () {});
    appResponse.on('end', function () {});
});


module.exports = router;
/*********** End of Service **********/