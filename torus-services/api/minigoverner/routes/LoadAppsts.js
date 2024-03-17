/*  Created BY      :Udhaya raj
    Created Date    :27-jun-2016
    pupose          :LoadAppsts in wp(Mini Governer)  

    @Api_Name : /LoadAppsts,
@Description: To LoadAppsts
@Last_Error_code:
      */
// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqLINQ = require("node-linq").LINQ;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');




//global Variable Initialization
var strServiceName = "LoadAppsts";


//Prepare query
const APPROLES = 'select appr_id,role_code,role_description from app_roles where app_id =?  allow filtering';
const APPSTS = 'select s_description,appsts_id,child_s_id,s_code,wft_code from app_system_to_system  where app_id=? and cluster_code=? allow filtering';
const APPSTSROLES = 'select appsts_id,appr_id,appstsr_id from app_system_to_system_roles where appsts_id in ?';



//Host the method to express
router.post('/LoadAppsts', function (appRequest, appResponse) {
    var objLogInfo;

    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            reqInstanceHelper.PrintInfo(strServiceName, 'Service Begined Successfully', objLogInfo);
            objLogInfo.HANDLER_CODE = 'LoadAppsts';
            objLogInfo.PROCESS = 'LoadAppsts-MiniGoverner';
            objLogInfo.ACTION_DESC = 'LoadAppsts';
            var Ismultiapp = sessionInfo.IS_MULTIAPP;
            var strTenantid = sessionInfo.TENANT_ID;

            var mHeaders = appRequest.headers;

            reqFXDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                reqInstanceHelper.PrintInfo(strServiceName, 'Cassandra Connection Initiated Successfully', objLogInfo);
                var mClient = pCltClient;
                //Variable Declare
                var strAppID = appRequest.body.PARAMS.APP_ID || sessionInfo.APP_ID;
                var strCluster = appRequest.body.PARAMS.CLUSTER;
                var strIsSearch = appRequest.body.PARAMS.IS_SEARCH;
                var strSyssearch = appRequest.body.PARAMS.SYS_SEARCH;
                var strOnlySysName = appRequest.body.PARAMS.ONLYSYSNAME;
                var ObjOnlySYSName = {};
                var objAppSTS = {};
                var arrAppRole = [];
                var arrAppRoles = [];
                var arrAppSys = [];
                var objapprout = {};
                var arrappstsout = {};
                var arrSystems = [];
                var cond = {};

                //Function call
                var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];
                cond = {};
                if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                    cond['tenant_id'] = strTenantid;
                }

                reqInstanceHelper.PrintInfo(strServiceName, 'Calling LoadAppsts Function', objLogInfo);
                if (Ismultiapp == 'Y') {
                    Getsystemlist();
                } else {
                    LoadAppsts();
                }




                function Getsystemlist() {
                    try {
                        reqFXDBInstance.GetTableFromFXDB(mClient, 'systems ', ['s_description', 's_id', 's_code', 'st_id', 'icon_data'], cond, objLogInfo, function callbacksystem(pError, pResult) {

                            if (pError) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51002', 'Error while Querying systems function', error, '', '');
                            } else {
                                //Linq to filter the result with search condition
                                // reqInstanceHelper.PrintInfo(strServiceName, 'Processing LINQ with result from app_system_to_system', objLogInfo);
                                if (pResult.rows.length) {

                                    var arrAppsts = pResult.rows;
                                    if (strSyssearch) {
                                        arrAppsts = []
                                        var searchrows = pResult.rows
                                        for (var i = 0; i < searchrows.length; i++) {
                                            if (searchrows[i].s_description.toUpperCase().indexOf(strSyssearch.toUpperCase()) != -1) {
                                                arrAppsts.push(searchrows[i])
                                            }
                                        }
                                    }
                                    for (i = 0; i < arrAppsts.length; i++) {
                                        var obj = {};
                                        obj.S_ID = arrAppsts[i].s_id;
                                        obj.S_DESCRIPTION = arrAppsts[i].s_description;
                                        obj.S_CODE = arrAppsts[i].s_code;
                                        obj.ST_ID = arrAppsts[i].st_id;
                                        obj.SYS_ICON = arrAppsts[i].icon_data;
                                        arrSystems.push(obj);
                                    }
                                    arrappstsout.APPSTS = arrSystems;
                                    // var arrappsts=arrSystems
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, arrappstsout, objLogInfo, '', '', '', '', '');
                                } else {
                                    arrappstsout.APPSTS = [];
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, arrappstsout, objLogInfo, '', '', '', '', '');
                                }
                            }
                        });


                    } catch (error) {

                    }


                }

                //Function Declare
                function LoadAppsts() {
                    try {
                        reqInstanceHelper.PrintInfo(strServiceName, 'Querying app_roles table', objLogInfo);
                        // Get approles cassandra execution
                        reqFXDBInstance.GetTableFromFXDB(mClient, 'app_roles', ['appr_id', 'role_code', 'role_description'], {
                            'app_id': strAppID
                        }, objLogInfo, function callbackLoadAppsts(pError, pResult) {
                            try {
                                if (pError) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51001', 'Error while Querying app_roles table', pError, '', '');
                                } else {
                                    reqInstanceHelper.PrintInfo(strServiceName, 'Got result from app_roles table', objLogInfo);
                                    arrAppRoles = pResult.rows;

                                    if (strIsSearch == 'Y') {
                                        reqInstanceHelper.PrintInfo(strServiceName, 'Querying app_system_to_system table', objLogInfo);
                                        if (strOnlySysName) {
                                            ObjOnlySYSName = {
                                                'app_id': strAppID
                                            };
                                        } else {
                                            ObjOnlySYSName = {
                                                'app_id': strAppID,
                                                'cluster_code': strCluster
                                            };
                                        }
                                        reqFXDBInstance.GetTableFromFXDB(mClient, 'app_system_to_system ', ['s_description', 'appsts_id', 'child_s_id', 's_code', 'wft_code', 'cluster_code', 'st_id', 'parent_s_id'], ObjOnlySYSName, objLogInfo, function callbackAppsts(pError, pResult) {
                                            try {
                                                if (pError) {
                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51002', 'Error while Querying app_system_to_system function', error, '', '');
                                                } else {
                                                    //Linq to filter the result with search condition
                                                    reqInstanceHelper.PrintInfo(strServiceName, 'Processing LINQ with result from app_system_to_system', objLogInfo);
                                                    var arrAppsts = new reqLINQ(pResult.rows)
                                                        .Where(function (u) {
                                                            if (u.s_description !== null) {
                                                                return u.s_description.toUpperCase().startsWith(strSyssearch.toUpperCase());
                                                            }

                                                        })
                                                        .ToArray();

                                                    function arrUnique(arr) {
                                                        var cleaned = [];
                                                        arr.forEach(function (itm) {
                                                            var unique = true;
                                                            cleaned.forEach(function (itm2) {
                                                                if (itm.s_code === itm2.s_code) unique = false;
                                                            });
                                                            if (unique) cleaned.push(itm);
                                                        });
                                                        return cleaned;
                                                    }
                                                    arrAppsts = arrUnique(arrAppsts);

                                                    reqInstanceHelper.PrintInfo(strServiceName, 'Getting appsts_id by LINQ if the query return result', objLogInfo);
                                                    //if query return the rows get the appsts_id alone
                                                    if (arrAppsts.length > 0) {
                                                        var arrAppstsID = new reqLINQ(arrAppsts)
                                                            .Select(function (u) {
                                                                return u.appsts_id;
                                                            }).ToArray();

                                                        // Get app_system_to_system_role function declare
                                                        _GetSTSRole(arrAppstsID, arrAppsts, strAppID, function callback(pRoleDesc, pRoleDetail) {

                                                            objAppSTS.APPSTS = arrAppRole;
                                                        });
                                                    } else {
                                                        //if appsts_id not available then form empty json APPSTS
                                                        arrAppSys.push();
                                                        objAppSTS.APPSTS = arrAppSys;
                                                        reqInstanceHelper.PrintInfo(strServiceName, 'LoadAppsts result : ' + JSON.stringify(arrappstsout), objLogInfo);
                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, objAppSTS, objLogInfo, '', '', '', '', '');
                                                    }
                                                }
                                            } catch (error) {
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51003', 'Error in app_system_to_system table', error, '', '');
                                            }
                                        });
                                    } else {
                                        //To do   strIsSearch = 'N' Not used client side
                                    }
                                }
                            } catch (error) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51004', 'Error in app_roles table', error, '', '');
                            }
                        });


                    } catch (error) {
                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51005', 'Error in calling LoadAppsts Fucntion', error, '', '');
                    }
                }

                //Get app_sysstem_to_system_role
                function _GetSTSRole(pAppstsID, pAppSTS, pAppID, pCallback) {
                    try {
                        var arrSystemAndRole = [];
                        reqInstanceHelper.PrintInfo(strServiceName, 'Querying app_system_to_system_roles table', objLogInfo);
                        reqFXDBInstance.GetTableFromFXDB(mClient, 'app_system_to_system_roles', ['appsts_id', 'appr_id', 'appstsr_id'], {
                            'appsts_id': pAppstsID
                        }, objLogInfo, function callbackAPPSTSROLES(pError, pResult) {
                            try {
                                if (pError) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51006', 'Error in Querying app_system_to_system_roles table', perror, '', '');
                                    //reqLogWriter.TraceError(objLogInfo, pError, "ERR-FX-10309");
                                } else {
                                    var strRoleDescription = '';
                                    var arrroles = [];

                                    // Loop for app sts
                                    reqInstanceHelper.PrintInfo(strServiceName, 'Preparing Linq with result from the app_system_to_system_roles begin', objLogInfo);
                                    for (i = 0; i < pAppSTS.length; i++) {
                                        // Assign sts properties
                                        var obj = {};
                                        obj.APPSTS_ID = pAppSTS[i].appsts_id;
                                        obj.CHILD_S_ID = pAppSTS[i].child_s_id;
                                        obj.S_DESCRIPTION = pAppSTS[i].s_description;
                                        obj.S_CODE = pAppSTS[i].s_code;
                                        obj.WORKFLOW = pAppSTS[i].wft_code;
                                        obj.PARENT_S_ID = pAppSTS[i].parent_s_id;
                                        obj.ST_ID = pAppSTS[i].st_id;
                                        // Get app sts roles
                                        var arrAppstsR = new reqLINQ(pResult.rows)
                                            .Where(function (u) {
                                                return u.appsts_id == pAppSTS[i].appsts_id;
                                            }).ToArray();

                                        // Loop for app sts roles
                                        var arrRoleDetails = [];
                                        var objrolesinfo = {};
                                        for (j = 0; j < arrAppstsR.length; j++) {
                                            var objRoleDetail = {};
                                            var strAppSTSId = arrAppstsR[j].appsts_id;
                                            //   _Getappsystems(APPSTS_ID);
                                            var strRoleDesc = _GetRoleDescription(arrAppstsR[j].appr_id);
                                            objRoleDetail.APPR_ID = arrAppstsR[j].appr_id;
                                            objRoleDetail.ROLE_DESCRIPTION = strRoleDesc;

                                            if (j == 0) {
                                                strRoleDescription = strRoleDesc;
                                            } else {
                                                strRoleDescription = strRoleDescription + ',' + strRoleDesc;
                                            }
                                            arrRoleDetails.push(objRoleDetail);
                                        }
                                        objrolesinfo.ROLES = arrRoleDetails;
                                        obj.ROLE = strRoleDescription;
                                        obj.ROLE_DETAIL = objrolesinfo;
                                        obj.CLUSTER_CODE = pAppSTS[i].cluster_code;
                                        arrAppSys.push(obj);
                                    }
                                    reqInstanceHelper.PrintInfo(strServiceName, 'Preparing Linq with result from the app_system_to_system_roles end', objLogInfo);
                                    // if (strOnlySysName) {
                                    //     var result = arrAppSys.filter(function (el, i, x) {
                                    //         return x.some(function (obj, j) {
                                    //             return obj.S_DESCRIPTION === el.S_DESCRIPTION && (x = j);
                                    //         }) && i == x;
                                    //     });
                                    //     arrAppSys = (result.length > 0) ? result : arrAppSys;
                                    // }
                                    /* Start -  Sorting data 18-APR-2018*/
                                    arrAppSys.sort(function (a, b) {
                                        var dataA = a.S_DESCRIPTION.toLowerCase(),
                                            dataB = b.S_DESCRIPTION.toLowerCase();
                                        if (dataA < dataB) //sort string ascending
                                            return -1;
                                        if (dataA > dataB)
                                            return 1;
                                        return 0; //default return value (no sorting)
                                    });
                                    /*END */
                                    arrappstsout.APPSTS = arrAppSys;
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, arrappstsout, objLogInfo, '', '', '', '', '');

                                }
                            } catch (error) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51007', 'Error in receiving callback from app_system_to_system_roles table', error, '', '');
                            }
                        });

                    } catch (error) {
                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51008', 'Error in calling _GetSTSRole table', error, '', '');
                    }
                }
                //Get the role description using appr_id -- [arrAppRoles array] 
                function _GetRoleDescription(pApprId) {
                    try {
                        var strRoleDesc = '';
                        var arrAppRolesLq = new reqLINQ(arrAppRoles)
                            .Where(function (u) {
                                return u.appr_id == pApprId;
                            }).ToArray();
                        if (arrAppRolesLq.length > 0)
                            strRoleDesc = arrAppRolesLq[0].role_description;
                        return strRoleDesc;

                    } catch (error) {
                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51009', 'Error in calling _GetRoleDescription Function', error, '', '');
                    }
                }
            });
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51010', 'Error in calling LoadAppsts API  Function', error, '', '');
    }
    appResponse.on('close', function () { });
    appResponse.on('finish', function () { });
    appResponse.on('end', function () { });
});

module.exports = router;
//*******End of Serive*******//