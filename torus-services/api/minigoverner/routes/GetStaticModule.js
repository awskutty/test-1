/*@Api_Name : /GetRolesWorkflow,
@Description: To GetRolesWorkflow
@Last_Error_code:'ERR-MIN-50604
*/



// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
const WFTEMP = 'select app_id,wft_code,wft_description from wf_templates where app_id=?';
const ROLESRW = 'select appr_id,role_code,role_description from app_roles where app_id=?';
var async = require('async');

var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');

//global variable Initialization
var strServiceName = "GetAllocatedStaticModule";


// Host the method to express
router.post('/GetAllocatedStaticModule', function (appRequest, appResponse) {
    var objLogInfo;
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            reqInstanceHelper.PrintInfo(strServiceName, 'Service Begined Successfully', objLogInfo);
            objLogInfo.HANDLER_CODE = 'GetAllocatedStaticModule';
            objLogInfo.PROCESS = 'GetAllocatedStaticModule-MiniGoverner';
            objLogInfo.ACTION_DESC = 'GetAllocatedStaticModule';
            var mHeaders = appRequest.headers;
            var RoleId = appRequest.body.PARAMS.ROLEID;
            if (typeof RoleId == "string") {
                var tempRole = RoleId
                RoleId = []
                RoleId.push(tempRole);
            }
            var ScreenName = appRequest.body.PARAMS.SCREEN_NAME;
            var allModulesAvailable = false;
            var finalReponse = [];
            mCltClient = ''
            if (!RoleId) {
                reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-MIN-51889', 'Role id not available', 'Please select the role');
            } else {
                mainfunction();
            }

            function GetModuleDetails() {
                var ModuleArr = [];
                var obj = {};
                var currentValue = '';



                async.forEachOfSeries(RoleId, function (value, key, callback1) {
                        currentValue = value;
                        try {
                            reqInstanceHelper.PrintInfo(strServiceName, 'Query APP_ROLE_STATIC_MODULE table |APP_ROLE_STATIC_MODULE', objLogInfo);
                            reqFXDBInstance.GetTableFromFXDB(mCltClient, 'APP_ROLE_STATIC_MODULE', [], {
                                'appr_id': value
                            }, objLogInfo, function callbackapproles(err, result) {
                                if (err) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-80921', 'Querying app_roles table have been Failed', err, '', '');
                                } else {
                                    if (result.rows.length) {
                                        var obj = {}
                                        reqInstanceHelper.PrintInfo(strServiceName, 'Got result from table | APP_ROLE_STATIC_MODULE', objLogInfo);
                                        var approl = result.rows;
                                        
                                        ModuleArr = [];
                                        for (var i = 0; i < approl.length; i++) {
                                            obj = {}
                                            ModuleArr = []
                                            let staticmodule = JSON.parse(approl[i].static_module);
                                            obj['appr_id'] = approl[i].appr_id
                                            obj['created_by'] = approl[i].created_by
                                            obj['created_date'] = approl[i].created_date
                                            obj['static_module'] = approl[i].static_module;

                                            finalReponse.push(obj);
                                            if (i == approl.length - 1) {
                                                callback1()
                                            }

                                        }
                                    } else {
                                        allModulesAvailable = true
                                        callback1()
                                    }
                                }
                            })
                        } catch (error) {
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-MIN-518810', 'Exception occured getallstaticModule function', error);
                        }
                    },
                    function (err) {
                        if (!err) {
                            if (ScreenName != 'ASSIGN_SCREEN' && allModulesAvailable == true) {
                                //user creation screen need to list all the static screens
                                reqInstanceHelper.PrintInfo(strServiceName, 'Allocated screen not available for this role. Going to get all static modules', objLogInfo);
                                getallstaticModule();
                            } else if (allModulesAvailable == false && finalReponse.length) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, finalReponse, objLogInfo, '', '', '', '', '');
                            } else {
                                //Prepare result 
                                var resobj = {};
                                resobj.static_module = JSON.stringify([]);
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, [resobj], objLogInfo, '', '', '', '', '');
                            }
                        } else {
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-MIN-51880', 'Exception occured getallstaticModule function', err);
                        }
                    });
            }

                    function getallstaticModule() {
                        try {
                            var objDesignerInfo = {};
                            var arrDesignerInfo = [];
                            reqFXDBInstance.GetTableFromFXDBNoCache(mCltClient, 'code_descriptions', ['code_value'], {
                                cd_code: 'STATIC_MODULE'
                            }, objLogInfo, function calbackGetTableFromFXDB(error, result) {
                                try {
                                    if (error) {
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-MIN-51883', 'Error in DesignerInfo function', error);
                                    } else {
                                        if (result.rows.length) {
                                            reqInstanceHelper.PrintInfo(strServiceName, 'Got static screen list. ', objLogInfo);
                                            objDesignerInfo.static_module = result.rows[0].code_value;
                                            arrDesignerInfo.push(objDesignerInfo);
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, arrDesignerInfo, objLogInfo);
                                        } else {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, '', '', null, 'FAILURE', 'No Designer info found');
                                        }
                                    }
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-MIN-51881', 'Exception occured getallstaticModule callback function', error);
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-MIN-51882', 'Exception occured getallstaticModule function', error);
                        }
                    }
            function mainfunction() {
                reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                    mCltClient = pCltClient;
                    getRolebasedscreen();

                    function getRolebasedscreen() {
                        try {
                            GetModuleDetails()
                        } catch (error) {
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-MIN-51885', 'Exception occured getRolebasedscreen function', error);
                        }
                    }
                });
            }
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-80922', 'Error in GetAllocatedStaticModule API function', error, '', '');
    }
    appResponse.on('close', function () { });
    appResponse.on('finish', function () { });
    appResponse.on('end', function () { });
});


module.exports = router;
/*********** End of Service **********/