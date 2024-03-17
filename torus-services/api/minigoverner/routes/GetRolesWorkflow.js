/*@Api_Name : /GetRolesWorkflow,
@Description: To GetRolesWorkflow
@Last_Error_code:'ERR-MIN-50604
*/



// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqServiceHelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');

var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

const WFTEMP = 'select app_id,wft_code,wft_description from wf_templates where app_id=?';
const ROLESRW = 'select appr_id,role_code,role_description from app_roles where app_id=?';


var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');;

//global variable Initialization
var strServiceName = "GetRolesWorkflow";


// Host the method to express
router.post('/GetRolesWorkflow', function (appRequest, appResponse) {
    var objLogInfo;
    var resultinfo = new resultinf();
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            reqInstanceHelper.PrintInfo(strServiceName, 'Service Begined Successfully', objLogInfo);
            objLogInfo.HANDLER_CODE = 'GetRolesWorkflow';
            objLogInfo.PROCESS = 'GetRolesWorkflow-MiniGoverner';
            objLogInfo.ACTION_DESC = 'GetRolesWorkflow';
            var mHeaders = appRequest.headers;
            var RolesNeeded = appRequest.body.PARAMS.Need_All_Roles || '';
            var reqestedAppId = appRequest.body.PARAMS.app_id
            var selectQuery = '';

            if (reqestedAppId) {
                objLogInfo.APP_ID = reqestedAppId
            }
            reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                reqInstanceHelper.PrintInfo(strServiceName, ' clt_cas Cassandra Connection Initiated Successfully', objLogInfo);
                var mCltClient = pCltClient;

                reqFXDBInstance.GetFXDBConnection(mHeaders, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(pDepClient) {
                    reqInstanceHelper.PrintInfo(strServiceName, 'dep_cas Cassandra Connection Initiated Successfully', objLogInfo);
                    var mDepClient = pDepClient;
                    // Initialize local variables
                    var sbWFT = '';
                    // if (RolesNeeded && RolesNeeded == 'Y') {
                    //     getallRoles();
                    // } else {
                    //prepare workflow template
                    reqInstanceHelper.PrintInfo(strServiceName, 'Querying wf_templates table', objLogInfo);
                    reqFXDBInstance.GetTableFromFXDBNoCache(mDepClient, 'wf_templates', ['app_id', 'wft_code', 'wft_description'], {
                        'app_id': sessionInfo.APP_ID
                    }, objLogInfo, function callbackwft(err, result) {
                        try {
                            if (err) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50601', 'Querying wf_templates table have been Failed', err, '', '');
                                reqInstanceHelper.PrintInfo(strServiceName, err.stack, objLogInfo);
                            } else {
                                var arrres = [];
                                reqInstanceHelper.PrintInfo(strServiceName, 'Got result from wf_templates table', objLogInfo);
                                for (var i = 0; i < result.rows.length; i++) {
                                    var obj = {};
                                    var wft = result.rows;
                                    obj.WFT_CODE = wft[i].wft_code;
                                    obj.WFT_DESCRIPTION = wft[i].wft_description;
                                    arrres.push(obj);
                                    resultinfo.WFT = arrres;
                                }
                                reqInstanceHelper.PrintInfo(strServiceName, 'Calling GetAppRoles function', objLogInfo);
                                GetAppRoles();
                            }
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, '', objLogInfo, 'ERR-MIN-50602', 'Error in receiving callback from wf_templates table', err, '', '');

                        }
                    });



                    function getSetupjsonvalue() {
                        return new Promise((resolve, reject) => {
                            try {
                                var cond = {};
                                cond.setup_code = ['NEW_USER_CREATION'];
                                reqServiceHelper.GetSetupJson(mCltClient, cond, objLogInfo, function (setupres) {
                                    if (setupres.Status == 'SUCCESS') {
                                        if (setupres.Data.length) {
                                            var NeedMaker = JSON.parse(setupres.Data[0].setup_json).NEED_APP_USER_ROLE_MENUS
                                            resolve(NeedMaker)
                                        }
                                    }
                                });
                            } catch (error) {
                                reject(error)
                            }
                        })
                    }



                    //Prepare app roles
                    function GetAppRoles() {
                        selectQuery = `select ar.appr_id,ar.role_description,ar.role_code from app_roles ar inner join app_systemtype_roles asr on ar.appr_id = asr.appr_id
                        where ar.app_id = '${objLogInfo.APP_ID}' and asr.st_id = '${sessionInfo.ST_ID}'`;
                        reqInstanceHelper.PrintInfo(strServiceName, 'Querying app system type role  table', objLogInfo);
                        reqFXDBInstance.ExecuteQuery(mCltClient, selectQuery, objLogInfo, async function caLlbacklitefiler(err, Result) {
                            try {
                                if (err) {
                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50777', 'Error while Querying ', err, 'FAILURE', '');
                                } else {
                                    if (Result.rows.length) {
                                        reqInstanceHelper.PrintInfo(strServiceName, 'app system type role table entry available.', objLogInfo);
                                        prepareRoles(Result);

                                    } else {
                                        reqInstanceHelper.PrintInfo(strServiceName, 'Querying app system type role entry not available.Going to get all Roles.', objLogInfo);
                                        // var response = await getSetupjsonvalue()
                                        if (appRequest.body.PARAMS.mode == 'ROLE_MENUS') {
                                            getRolesMenu();
                                        } else {
                                            getallRoles();
                                        }
                                    }
                                }
                            } catch (error) {
                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50743', 'Error while  Executing Searchquery', error, '', '');
                            }
                        });
                    }

                    function getallRoles() {
                        try {
                            var appRole = `select appr_id,role_description,role_code from app_roles where app_id='${objLogInfo.APP_ID}'`;
                            reqFXDBInstance.ExecuteQuery(mCltClient, appRole, objLogInfo, function caLlbacklitefiler(pErr, roleResult) {
                                if (!pErr) {
                                    prepareRoles(roleResult);
                                } else {
                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50780', 'Error while Querying ', pErr, 'FAILURE', '');
                                }
                            });
                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50778', 'Exception occured getallRoles', error, 'FAILURE', '');
                        }
                    }

                    function prepareRoles(Result) {
                        try {
                            var arresult = [];
                            reqInstanceHelper.PrintInfo(strServiceName, 'Got result roles,preparing result ', objLogInfo);
                            var approl = Result.rows;
                            for (var i = 0; i < Result.rows.length; i++) {
                                if (approl[i].role_code == "SuperAdmin") {
                                    continue;
                                }
                                var obj = {};
                                obj.label = approl[i].role_description;
                                obj.data = approl[i].appr_id;

                                arresult.push(obj);
                                resultinfo.ROLES = arresult;
                                resultinfo.isRoleOnly = 'Y'
                            }
                            reqInstanceHelper.SendResponse(strServiceName, appResponse, resultinfo, objLogInfo, '', '', '', '', '');
                        } catch (error) {
                            return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50779', 'Exception occured prepareRoles', error, 'FAILURE', '');
                        }
                    }

                    function getRolesMenu() {
                        var menuinfo = `select wfmi.app_id,wfmi.menu_json,wfmi.wft_code,appr.appr_id,appr.role_code,appr.role_description from dep_tran.wf_menu_info wfmi inner join clt_tran.app_roles appr
                        on appr.appr_id = wfmi.appr_id where wfmi.app_id='${objLogInfo.APP_ID}'`;
                        reqFXDBInstance.ExecuteQuery(mDepClient, menuinfo, objLogInfo, function caLlbacklitefiler(pErr, roleResult) {
                            try {
                                if (pErr) {
                                    return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50780', 'Error while Querying ', pErr, 'FAILURE', '');
                                } else {
                                    var menuarr = [];
                                    var menurole = roleResult.rows;
                                    for (var r = 0; r < roleResult.rows.length; r++) {

                                        if (menurole[r].role_code == 'SuperAdmin') {
                                            continue;
                                        }
                                        var menuobj = {}
                                        menuobj.label = menurole[r].role_description;
                                        menuobj.data = menurole[r].appr_id;
                                        menuobj.nodetype = 'role'
                                        menuobj.expanded = true
                                        menuobj.children = [];
                                        var modules = JSON.parse(menurole[r].menu_json).MODULES

                                        for (var i = 0; i < modules.length; i++) {
                                            var resobj = {}
                                            var curMG = modules[i].MENUGROUPS
                                            resobj.label = modules[i].UIM_DESCRIPTION;
                                            resobj.data = modules[i].UIM_DESCRIPTION;
                                            resobj.MDLCode = modules[i].UIM_CODE;
                                            resobj.nodetype = 'module';
                                            resobj.role_id = menurole[r].appr_id;
                                            resobj.expanded = true
                                            resobj.children = [];
                                            if (curMG.length) {
                                                for (var j = 0; j < curMG.length; j++) {
                                                    var mgObj = {};
                                                    var curMI = curMG[j].MENUITEMS
                                                    mgObj.label = curMG[j].UIMG_DESCRIPTION;
                                                    mgObj.data = curMG[j].UIMG_DESCRIPTION;
                                                    mgObj.MGCode = curMG[j].UIMG_CODE;
                                                    mgObj.nodetype = 'menugroup';
                                                    mgObj.expanded = true
                                                    mgObj.MDLCode = modules[i].UIM_CODE;
                                                    mgObj.children = [];
                                                    if (curMI.length) {
                                                        for (var k = 0; k < curMI.length; k++) {
                                                            var miobj = {};
                                                            miobj.label = curMI[k].UIMI_SCREEN_NAME;
                                                            miobj.data = curMI[k].UIMI_DESCRIPTION;
                                                            miobj.MICode = curMI[k].UIMI_CODE;
                                                            miobj.nodetype = 'menuitem';
                                                            miobj.MGCode = curMG[j].UIMG_CODE;
                                                            miobj.expanded = true
                                                            mgObj.children.push(miobj)

                                                        }
                                                        if (mgObj.children.length) {
                                                            resobj.children.push(mgObj)
                                                        }
                                                    }
                                                }
                                                if (resobj.children.length) {
                                                    menuobj.children.push(resobj)
                                                }
                                            }

                                        }
                                        if (menuobj.children.length) {
                                            menuarr.push(menuobj)
                                        }

                                    }

                                    resultinfo.ROLES = menuarr
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, resultinfo, objLogInfo, '', '', '', '', '');
                                }
                            } catch (error) {
                                return reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50779', 'Exception occured getRolesMenu', error, 'FAILURE', '');
                            }
                        });
                    }
                });
            });
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50604', 'Error in GetRolesWorkflow API function', error, '', '');
    }


    function resultinf() {
        var WFT = [];
        var ROLES = [];
    }

    appResponse.on('close', function () { });
    appResponse.on('finish', function () { });
    appResponse.on('end', function () { });
});


module.exports = router;
/*********** End of Service **********/