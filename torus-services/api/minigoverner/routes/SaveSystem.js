/*
 Modified By UdhayaRaj on 08-03-2017 for insert app_system_to_system table while create a new system
 @Api_Name : /SaveSystem,
@Description: To SaveSystem
@Last_Error_code:ERR-MIN-50542

*/
// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqLINQ = require("node-linq").LINQ;
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance')
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');

//Global variable Initialization
var strServiceName = "SaveSystem";

const TOTALSYSTEM = 'update fx_total_items set counter_value = counter_value + 1 where code=\'SYSTEMS\'';
const SYSTOSYS = 'update fx_total_items set counter_value = counter_value + 1 where code=\'SYSTEM_TO_SYSTEM\'';
const TOTALAPPSTS = 'update fx_total_items set counter_value = counter_value + 1 where code=\'APP_SYSTEM_TO_SYSTEM\'';
const TOTALAPPST = 'update fx_total_items set counter_value = counter_value + 1 where code=\'APP_SYSTEM_TYPES\'';

// Host the Method to express
router.post('/SaveSystem', function (appRequest, appResponse) {
    var objLogInfo;
    var mHeaders = appRequest.headers;
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (resObjLogInfo, sessionInfo) {
            objLogInfo = resObjLogInfo
            objLogInfo.PROCESS_INFO.PROCESS_NAME = 'Save_System';
            reqTranDBHelper.GetTranDBConn(mHeaders, false, function (tran_db_instance) {
                reqAuditLog.GetProcessToken(tran_db_instance, objLogInfo, function (error, prct_id) {
                    objLogInfo.HANDLER_CODE = 'SaveSystem';
                    objLogInfo.PROCESS = 'SaveSystem-MiniGoverner';
                    objLogInfo.ACTION_DESC = 'SaveSystem';

                    var blnIsMultiapp = sessionInfo.IS_MULTIAPP;
                    reqInstanceHelper.PrintInfo(strServiceName, 'Service Begined Successfully', objLogInfo);
                    reqDBInstance.GetFXDBConnection(mHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                        reqTranDBInstance.GetTranDBConn(mHeaders, false, function (tran_db_instance) {
                            reqInstanceHelper.PrintInfo(strServiceName, 'Cassandra session initiated Successfully', objLogInfo);
                            var mCltClient = pCltClient;
                            appResponse.setHeader('Content-Type', 'application/json');

                            // Initialize Global variables
                            var Client_id = sessionInfo.CLIENT_ID;
                            var APP_ID = sessionInfo.APP_ID;
                            var tenant_id = sessionInfo.TENANT_ID;
                            var System_Params = appRequest.body.PARAMS.SYS_PARAMS;
                            var U_ID = sessionInfo.U_ID;
                            var S_ID = sessionInfo.S_ID;
                            var S_DESC = sessionInfo.S_DESC;
                            var USER_NAME = sessionInfo.USER_NAME;
                            var Sys_Type_id = System_Params.SYS_TYPE_ID;
                            var Sys_Code = System_Params.SYS_CODE;
                            var Sys_Desc = System_Params.SYS_DESC;
                            var Sys_Icon = System_Params.SYS_ICON;
                            var Parent_Sys_id = System_Params.PARENT_SYS_ID;
                            if (Parent_Sys_id == "") {
                                Parent_Sys_id = "0";
                            }
                            var StCode = '';
                            var StDesc = '';
                            var IsEnabled = System_Params.IsEnabled;
                            var AppstsId = System_Params.APPSTS_ID;
                            var S_Category = System_Params.S_CATEGORY;
                            var Cluster_Code = System_Params.CLUSTER_CODE;
                            var Isedit_system = System_Params.IS_EDIT;
                            var UNIQ_S_ID = '';
                            var UNIQ_STS_ID = '';
                            var SystemTypeTargetTable = '';
                            var system_type_code = '';
                            var system_type_desc = '';
                            var parent_sys_type_id = '';
                            var parent_sys_type_code = '';
                            var parent_sys_type_desc = '';

                            var parent_sys_code = '';
                            var parent_sys_desc = '';
                            var extended_dt_code = '';
                            var extended_dtt_code = '';
                            var finalres = 'FAILURE';
                            reqInstanceHelper.PrintInfo(strServiceName, 'Querying systems table ', objLogInfo);
                            //Query systems table if sys code already exists
                            // Tenant filter added additionally
                            reqDBInstance.GetTableFromFXDB(mCltClient, 'systems', [], {
                                'st_id': Sys_Type_id,
                                'client_id': Client_id,
                                'tenant_id': objLogInfo.TENANT_ID
                            }, objLogInfo, function callbacksys(err, result) {
                                if (err) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50501', 'Querying systems table have been Failed', err, '', '');
                                } else {
                                    reqInstanceHelper.PrintInfo(strServiceName, 'Got result from systems table', objLogInfo);
                                    var arrSYS = new reqLINQ(result.rows)
                                        .Where(function (u) {
                                            return u.s_code.toUpperCase() == Sys_Code.toUpperCase();
                                        }).ToArray();
                                    if (arrSYS.length > 0 && Isedit_system == 'N') {
                                        finalres = JSON.stringify("System code already exists");
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, finalres, objLogInfo, '', '', '', '', '');
                                    } else if (arrSYS.length > 0 && Isedit_system == 'Y') {
                                        var sysid = arrSYS[0].s_id;
                                        //upddate the system table
                                        reqDBInstance.UpdateFXDB(mCltClient, 'systems', {
                                            "s_description": Sys_Desc,
                                            'icon_data': Sys_Icon,
                                            'prct_id': prct_id
                                        }, {
                                            'client_id': Client_id,
                                            'st_id': Sys_Type_id,
                                            's_id': sysid
                                        }, objLogInfo, function systemUpdate(err, result) {
                                            if (err) {
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-AUT-50526', 'Error while update system ', err, '', '');
                                            } else {
                                                var condOBj = {
                                                    'app_id': APP_ID,
                                                    'cluster_code': Cluster_Code
                                                };
                                                if (AppstsId) {
                                                    condOBj['appsts_id'] = AppstsId;
                                                }
                                                reqDBInstance.UpdateFXDB(mCltClient, 'app_system_to_system', {
                                                    'is_enabled': IsEnabled,
                                                    "s_description": Sys_Desc,
                                                    'prct_id': prct_id
                                                }, condOBj, objLogInfo, function updateResponse(error, res) {
                                                    if (error) {
                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-AUT-50525', 'Error while update system to system ', error, '', '');
                                                    } else {
                                                        reqInstanceHelper.PrintInfo(strServiceName, 'system Updated  Successfully ', objLogInfo);
                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, "SUCCESS", objLogInfo);
                                                    }
                                                });
                                            }
                                        });
                                    } else {
                                        //New system insert
                                        checkSysCreationEligiblity(function (res) {
                                            if (res) {
                                                CheckSysTypeTargetTableExist(null, function (params) {
                                                    reqInstanceHelper.PrintInfo(strServiceName, 'Querying TOTALSYSTEM table on the Success of systems table result', objLogInfo);
                                                    reqDBInstance.ExecuteQuery(mCltClient, TOTALSYSTEM, objLogInfo, function callbackgetsys(err) {
                                                        try {
                                                            if (err) {
                                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50502', 'Error While Querying TOTALSYSTEM table', err, '', '');
                                                            } else {
                                                                reqInstanceHelper.PrintInfo(strServiceName, 'Querying fx_total_items table on the Success of TOTALSYSTEM table result', objLogInfo);
                                                                reqDBInstance.GetTableFromFXDB(mCltClient, 'fx_total_items', ['counter_value'], {
                                                                    'code': 'SYSTEMS'
                                                                }, objLogInfo, function callbackgetsyscount(err, result) {
                                                                    try {
                                                                        if (err) {
                                                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50503', 'Error While Querying fx_total_items table', err, '', '');
                                                                        } else {
                                                                            reqInstanceHelper.PrintInfo(strServiceName, 'Got result from fx_total_items table', objLogInfo);
                                                                            for (var i = 0; i < result.rows.length; i++) {
                                                                                var syscount = result.rows;
                                                                                UNIQ_S_ID = syscount[i].counter_value;
                                                                            }
                                                                            var insertSystemObj = [{
                                                                                'client_id': Client_id,
                                                                                'st_id': Sys_Type_id,
                                                                                's_id': UNIQ_S_ID.toString(),
                                                                                's_category': S_Category,
                                                                                's_code': Sys_Code,
                                                                                's_description': Sys_Desc,
                                                                                'created_by': U_ID,
                                                                                'created_date': reqDateFormater.GetTenantCurrentDateTime(mHeaders, objLogInfo),
                                                                                'icon_data': Sys_Icon,
                                                                                'prct_id': prct_id
                                                                            }];
                                                                            var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
                                                                            if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                                                                                insertSystemObj[0]['tenant_id'] = tenant_id;
                                                                            }
                                                                            reqInstanceHelper.PrintInfo(strServiceName, 'Querying systems table on the Success of fx_total_items table result', objLogInfo);
                                                                            reqDBInstance.InsertFXDB(mCltClient, 'systems', insertSystemObj, objLogInfo, function callbackinstotsys(err) {
                                                                                try {
                                                                                    if (err) {
                                                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50504', 'Error while Querying systems table for second time', err, '', '');
                                                                                    } else {
                                                                                        reqInstanceHelper.PrintInfo(strServiceName, 'System have been saved successfully', objLogInfo);
                                                                                        if (SystemTypeTargetTable) {
                                                                                            SystemsTargetTableInsert({}, function (params) {
                                                                                                if (blnIsMultiapp == "Y") {
                                                                                                    reqInstanceHelper.PrintInfo(strServiceName, 'Multi app system save,No need of sts and appsts entry', objLogInfo);
                                                                                                    LanuagetableInsert();
                                                                                                } else {
                                                                                                    reqInstanceHelper.PrintInfo(strServiceName, 'Calling  GetStsCount fucntion', objLogInfo);
                                                                                                    GetStsCount();
                                                                                                }
                                                                                            });
                                                                                        } else {
                                                                                            if (blnIsMultiapp == "Y") {
                                                                                                reqInstanceHelper.PrintInfo(strServiceName, 'Multi app system save,No need of sts and appsts entry', objLogInfo);
                                                                                                LanuagetableInsert();
                                                                                            } else {
                                                                                                reqInstanceHelper.PrintInfo(strServiceName, 'Calling  GetStsCount fucntion', objLogInfo);
                                                                                                GetStsCount();
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                } catch (error) {
                                                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50505', 'Error receiving callback from systems table', error, '', '');
                                                                                }
                                                                            });
                                                                        }
                                                                    } catch (error) {
                                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50506', 'Error receiving callback from fx_total_items table', error, '', '');
                                                                    }
                                                                });
                                                            }
                                                        } catch (error) {
                                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50507', 'Error receiving callback from TOTALSYSTEM table', error, '', '');
                                                        }
                                                    });
                                                });
                                            } else {
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50533', `You have exceeded the license limit to create "${StDesc}". Please contact system administrator.`, '', '', '');
                                            }
                                        });
                                    }
                                }
                            });


                            function checkSysCreationEligiblity(pcallback) {
                                try {
                                    reqInstanceHelper.PrintInfo(strServiceName, 'Check license setup', objLogInfo);
                                    reqDBInstance.GetTableFromFXDB(mCltClient, 'SYSTEM_TYPES', [], {
                                        st_id: Sys_Type_id
                                    }, objLogInfo, function (pErr, pres) {
                                        if (pErr) {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50509', 'Error while Querying systems_types table for get st_code', pErr, '', '');
                                        } else {
                                            if (pres.rows.length) {
                                                StCode = pres.rows[0].st_code;
                                                StDesc = pres.rows[0].st_description;
                                                var reqObj = {
                                                    type: 'SYSTEM_TYPE',
                                                    stCode: StCode
                                                };
                                                reqsvchelper.GetLicenseSetup(objLogInfo, reqObj, function (resSetup) {
                                                    try {
                                                        if (resSetup.Status == "SUCCESS") {
                                                            reqInstanceHelper.PrintInfo(strServiceName, 'Got the license setup. Max system count in setup |' + resSetup.Data.MAX_COUNT, objLogInfo);
                                                            //if count is -1 no need to check the system count. There is no limit to create new system
                                                            if (resSetup.Data.MAX_COUNT == -1 || resSetup.Data == 'SKIP_LICENSE_VERIFICATION') {
                                                                pcallback(true);
                                                            } else {
                                                                // var countQuery = `select COUNT(*) AS COUNT from SYSTEMS S INNER JOIN SYSTEM_TYPES ST ON ST.ST_ID=S.ST_ID WHERE ST.ST_CODE='${StCode}' AND S.TENANT_ID='${sessionInfo.TENANT_ID}' `;

                                                                var countQuery = {
                                                                    query: `select COUNT(*) AS COUNT from SYSTEMS S INNER JOIN SYSTEM_TYPES ST ON ST.ST_ID=S.ST_ID WHERE ST.ST_CODE=? AND S.TENANT_ID=? `,
                                                                    params: [StCode, sessionInfo.TENANT_ID]
                                                                };
                                                                reqDBInstance.ExecuteSQLQueryWithParams(mCltClient, countQuery, objLogInfo, function (pRes, pErr) {
                                                                    if (pErr) {
                                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50544', 'Error occured while getting count of systems', pErr, 'FAILURE', '');
                                                                    } else {
                                                                        var sysCount = parseInt(pRes.rows[0].count);
                                                                        reqInstanceHelper.PrintInfo(strServiceName, `Total number of system available in db for system type - ${StCode} | ${sysCount}`, objLogInfo);
                                                                        // if (sysCount == 0) {
                                                                        //     reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50545', '', `You have exceeded the license limit to create "${StDesc}". Please contact system administrator.`, 'FAILURE', '');
                                                                        // } else 
                                                                        if (resSetup.Data.MAX_COUNT <= sysCount) {
                                                                            reqInstanceHelper.PrintInfo(strServiceName, ` System limited reached.Not allowed to create new system `, objLogInfo);
                                                                            pcallback(false);
                                                                        } else {
                                                                            pcallback(true);
                                                                        }
                                                                    }
                                                                });
                                                            }
                                                        } else if (resSetup.ErrorCode == '404') {
                                                            reqInstanceHelper.PrintInfo(strServiceName, resSetup.Error, objLogInfo);
                                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50545', '', resSetup.Error, 'FAILURE', '');
                                                        } else {
                                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50546', 'Error occured while getting count of systems', resSetup.Error, 'FAILURE', '');
                                                        }
                                                    } catch (error) {
                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50548', 'Exception occured ', error, '', '');
                                                    }
                                                });
                                            } else {
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50545', 'Requested system type not available.', ' System type not found', 'FAILURE', '');
                                            }
                                        }
                                    });
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50548', 'Exception occured while checkSysCreationEligiblity function ', error, '', '');
                                }
                            }

                            function SystemsTargetTableInsert(params, SystemsTargetTableInsertCB) {
                                try {
                                    reqDBInstance.GetTableFromFXDB(mCltClient, 'systems', [], {
                                        's_id': Parent_Sys_id
                                    }, objLogInfo, function callbacksys(err, result) {
                                        if (err) {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50541', 'Querying systems table have been Failed', err, '', '');
                                        } else {
                                            if (!result.rows.length) {
                                                parent_sys_code = '';
                                                parent_sys_desc = '';
                                                parent_sys_type_id = '';
                                            } else {
                                                parent_sys_code = result.rows[0].s_code;
                                                parent_sys_desc = result.rows[0].s_description;
                                                parent_sys_type_id = result.rows[0].st_id;
                                            }


                                            // Getting Data from system_types Table
                                            reqDBInstance.GetTableFromFXDB(mCltClient, 'system_types', [], {
                                                'st_id': parent_sys_type_id
                                            }, objLogInfo, function callbacksys(err, result) {
                                                if (err) {
                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50541', 'Querying systems table have been Failed', err, '', '');
                                                } else {
                                                    if (!result.rows.length) {
                                                        parent_sys_type_code = '';
                                                        parent_sys_type_desc = '';
                                                    } else {
                                                        parent_sys_type_code = result.rows[0].st_code;
                                                        parent_sys_type_desc = result.rows[0].st_description;
                                                    }
                                                    var SystemTypeTargetTableInsertData = [{
                                                        system_id: S_ID,
                                                        system_name: S_DESC,
                                                        s_id: UNIQ_S_ID.toString(),
                                                        s_code: Sys_Code,
                                                        s_description: Sys_Desc,
                                                        st_id: Sys_Type_id,
                                                        st_code: system_type_code,
                                                        st_description: system_type_desc,
                                                        created_by: U_ID,
                                                        created_by_name: USER_NAME,
                                                        created_date: reqDateFormater.GetTenantCurrentDateTime(mHeaders, objLogInfo),
                                                        parent_s_id: Parent_Sys_id,
                                                        parent_s_code: parent_sys_code,
                                                        parent_s_description: parent_sys_desc,
                                                        parent_st_id: parent_sys_type_id,
                                                        parent_st_code: parent_sys_type_code,
                                                        parent_st_description: parent_sys_type_desc,
                                                        dt_code: extended_dt_code,
                                                        dtt_code: extended_dtt_code,
                                                        status: 'CREATED',
                                                        process_status: 'CREATED'
                                                    }];
                                                    // System_type - Target Table Insert Process Started Here
                                                    reqTranDBInstance.InsertTranDBWithAudit(tran_db_instance, SystemTypeTargetTable, SystemTypeTargetTableInsertData, objLogInfo, function (pResult, err) {
                                                        if (err) {
                                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50540', 'Error While Inserting into System Type Target Table - ' + SystemTypeTargetTable, err, '', '');
                                                        } else {
                                                            SystemsTargetTableInsertCB(null, null);
                                                        }
                                                    });
                                                }
                                            });
                                        }
                                    });
                                } catch (error) {
                                    SystemsTargetTableInsertCB(error, null);
                                }
                            }


                            // To Check the System Type Target Table is Existing or Not 
                            function CheckSysTypeTargetTableExist(params, CheckSysTypeTargetTableExistCB) {
                                try {
                                    reqDBInstance.GetTableFromFXDB(mCltClient, 'system_types', ['target_table', 'extended_dt_code', 'extended_dtt_code', 'st_code', 'st_description'], {
                                        'st_id': Sys_Type_id
                                    }, objLogInfo, function (pErr, pRes) {
                                        if (pErr) {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50536', 'Querying system_types table have been Failed', pErr, '', '');
                                        } else {
                                            if (pRes.rows.length) {
                                                SystemTypeTargetTable = pRes.rows[0].target_table;
                                                system_type_code = pRes.rows[0].st_code;
                                                system_type_desc = pRes.rows[0].st_description;
                                                extended_dt_code = pRes.rows[0].extended_dt_code;
                                                extended_dtt_code = pRes.rows[0].extended_dtt_code;
                                                if (SystemTypeTargetTable) {
                                                    var condObj = {
                                                        s_id: 0
                                                    };
                                                    reqTranDBInstance.GetTableFromTranDB(tran_db_instance, SystemTypeTargetTable, condObj, objLogInfo, function (result, error) {
                                                        if (error) {
                                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-MIN-50039', 'Target Table from System_Type Table is Not Found...', error);
                                                        } else {
                                                            CheckSysTypeTargetTableExistCB();
                                                        }
                                                    });
                                                } else {
                                                    reqInstanceHelper.PrintInfo(strServiceName, 'Target Table is not present in the Tenant Setup Json...', objLogInfo);
                                                    CheckSysTypeTargetTableExistCB();
                                                    // reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-MIN-50038', 'There is No Target Table from System_Type Json...', '');
                                                }
                                            } else {
                                                reqInstanceHelper.PrintInfo(strServiceName, 'system type code not found for this st_id ' + Sys_Type_id, objLogInfo);
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50537', 'System type entry not found', 'System type entry not found', '', '');
                                            }
                                        }
                                    });
                                } catch (error) {
                                    console.log(error);
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-AUT-11540', 'Error in CheckSysTypeTargetTableExist() ', error, '', '');
                                }
                            }



                            //Prepare system to system count
                            function GetStsCount() {
                                try {
                                    reqInstanceHelper.PrintInfo(strServiceName, 'Querying SYSTOSYS table', objLogInfo);
                                    reqDBInstance.ExecuteQuery(mCltClient, SYSTOSYS, objLogInfo, function callbackuptotsystosys(err) {
                                        try {
                                            if (err) {
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-AUT-11402', 'Error while Querying SYSTOSYS table', err, '', '');
                                            } else {
                                                reqInstanceHelper.PrintInfo(strServiceName, 'Querying fx_total_items table on the success of SYSTOSYS table', objLogInfo);
                                                reqDBInstance.GetTableFromFXDB(mCltClient, 'fx_total_items', ['counter_value'], {
                                                    'code': 'SYSTEM_TO_SYSTEM'
                                                }, objLogInfo, function callbackstscount(err, result) {
                                                    try {
                                                        if (err) {
                                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-AUT-11402', 'Error while Querying fx_total_items table', err, '', '');
                                                        } else {
                                                            reqInstanceHelper.PrintInfo(strServiceName, 'Got result from fx_total_items table', objLogInfo);
                                                            for (var i = 0; i < result.rows.length; i++) {
                                                                var stscount = result.rows;
                                                                UNIQ_STS_ID = stscount[i].counter_value;
                                                            }
                                                            reqInstanceHelper.PrintInfo(strServiceName, 'Querying  system_to_system table', objLogInfo);
                                                            reqDBInstance.InsertFXDB(mCltClient, 'system_to_system', [{
                                                                'sts_id': UNIQ_STS_ID.toString(),
                                                                'cluster_code': Cluster_Code,
                                                                'parent_s_id': Parent_Sys_id,
                                                                'child_s_id': UNIQ_S_ID.toString(),
                                                                'child_s_description': Sys_Desc,
                                                                'created_by': U_ID,
                                                                'created_date': reqDateFormater.GetTenantCurrentDateTime(mHeaders, objLogInfo),
                                                                'prct_id': prct_id
                                                            }], objLogInfo, function callbackinssts(err) {
                                                                try {
                                                                    if (err) {
                                                                        finalres = JSON.stringify(finalres);
                                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, finalres, objLogInfo, 'ERR-AUT-11402', 'Error while Querying system_to_system table', err, 'FAILURE', '');
                                                                    } else {
                                                                        reqInstanceHelper.PrintInfo(strServiceName, 'System saved successfully', objLogInfo);
                                                                        assignsystem();
                                                                    }
                                                                } catch (error) {
                                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-AUT-11402', 'Error in receiving system_to_system callback ', error, '', '');
                                                                }
                                                            });
                                                        }
                                                    } catch (error) {
                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-AUT-11402', 'Error in  receiving fx_total_items callback ', error, '', '');
                                                    }
                                                });
                                            }
                                        } catch (error) {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-AUT-11402', 'Error in  receiving SYSTOSYS callback ', error, '', '');
                                        }
                                    });

                                } catch (error) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-AUT-11402', 'Error in calling GetStsCount', error, '', '');
                                }
                            }

                            function assignsystem() {
                                reqInstanceHelper.PrintInfo(strServiceName, 'Querying TOTALAPPSTS table', objLogInfo);
                                reqDBInstance.ExecuteQuery(mCltClient, TOTALAPPSTS, objLogInfo, function callbacktotapp(err) {
                                    try {
                                        if (err) {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50508', 'Querying TOTALAPPSTS table have been Failed', err, '', '');
                                        } else {
                                            reqInstanceHelper.PrintInfo(strServiceName, 'Querying fx_total_items table on the Success of TOTALAPPSTS table result', objLogInfo);
                                            reqDBInstance.GetTableFromFXDB(mCltClient, 'fx_total_items', ['counter_value'], {
                                                'code': 'APP_SYSTEM_TO_SYSTEM'
                                            }, objLogInfo, function callbackappsts(err, result) {
                                                try {
                                                    if (err) {
                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50509', 'Querying fx_total_items table have been Failed', err, '', '');
                                                    } else {
                                                        reqInstanceHelper.PrintInfo(strServiceName, 'Got result from fx_total_items table', objLogInfo);
                                                        UNIQ_APPSTS_ID = result.rows[0].counter_value.toString();
                                                        reqInstanceHelper.PrintInfo(strServiceName, 'New APPSTS_ID is ' + UNIQ_APPSTS_ID, objLogInfo);
                                                        reqInstanceHelper.PrintInfo(strServiceName, 'Querying app_system_to_system table on the Success of fx_total_items table result', objLogInfo);
                                                        getSTCode(Sys_Type_id, function (res) {
                                                            reqDBInstance.InsertFXDB(mCltClient, 'app_system_to_system', [{
                                                                'appsts_id': UNIQ_APPSTS_ID.toString(),
                                                                'app_id': APP_ID,
                                                                'cluster_code': Cluster_Code,
                                                                'child_s_id': UNIQ_S_ID.toString(),
                                                                'parent_s_id': Parent_Sys_id,
                                                                's_description': Sys_Desc,
                                                                's_id': UNIQ_S_ID.toString(),
                                                                'st_id': Sys_Type_id,
                                                                'st_code': res.st_code,
                                                                'sts_id': UNIQ_STS_ID.toString(),
                                                                'created_by': U_ID,
                                                                'created_date': reqDateFormater.GetTenantCurrentDateTime(mHeaders, objLogInfo),
                                                                's_code': Sys_Code,
                                                                'is_enabled': IsEnabled,
                                                                'prct_id': prct_id
                                                            }], objLogInfo, function callbackpappsts(err) {
                                                                try {
                                                                    if (err) {
                                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50510', 'Querying TOTALAPPSTS table have been Failed', err, '', '');
                                                                    } else {
                                                                        reqDBInstance.ExecuteQuery(mCltClient, TOTALAPPST, objLogInfo, function callbacktotapp(err) {
                                                                            try {
                                                                                if (err) {
                                                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50511', 'Querying TOTALAPPST table have been Failed', err, '', '');
                                                                                } else {
                                                                                    reqInstanceHelper.PrintInfo(strServiceName, 'Querying fx_total_items table on the Success of TOTALAPPST table result', objLogInfo);
                                                                                    reqDBInstance.GetTableFromFXDB(mCltClient, 'fx_total_items', ['counter_value'], {
                                                                                        'code': 'APP_SYSTEM_TYPES'
                                                                                    }, objLogInfo, function callbackappstt(err, rest) {
                                                                                        try {
                                                                                            if (err) {
                                                                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50512', 'Querying fx_total_items table have been Failed', err, '', '');
                                                                                            } else {
                                                                                                reqInstanceHelper.PrintInfo(strServiceName, 'Got result from fx_total_items table', objLogInfo);
                                                                                                UNIQ_APPST_ID = rest.rows[0].counter_value.toString();
                                                                                                reqInstanceHelper.PrintInfo(strServiceName, 'New APPST_ID is ' + UNIQ_APPST_ID, objLogInfo);
                                                                                                reqInstanceHelper.PrintInfo(strServiceName, 'Querying system_types table', objLogInfo);
                                                                                                reqDBInstance.GetTableFromFXDB(mCltClient, 'system_types', ['st_description'], {
                                                                                                    'st_id': Sys_Type_id
                                                                                                }, objLogInfo, function callbackSysType(err, reslt) {
                                                                                                    try {
                                                                                                        if (err) {
                                                                                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50513', 'Querying system_types table have been Failed', err, '', '');
                                                                                                        } else {
                                                                                                            var St_description = '';
                                                                                                            St_description = reslt.rows[0].st_description;
                                                                                                            reqInstanceHelper.PrintInfo(strServiceName, 'Querying app_system_types table', objLogInfo);
                                                                                                            reqDBInstance.InsertFXDB(mCltClient, 'app_system_types', [{
                                                                                                                'appst_id': UNIQ_APPST_ID,
                                                                                                                'app_id': APP_ID,
                                                                                                                'st_description': St_description,
                                                                                                                'st_id': Sys_Type_id,
                                                                                                                'created_by': U_ID,
                                                                                                                'created_date': reqDateFormater.GetTenantCurrentDateTime(mHeaders, objLogInfo),
                                                                                                            }], objLogInfo, function callbackinsapps(err) {
                                                                                                                try {
                                                                                                                    if (err) {
                                                                                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50514', 'Querying app_system_types table have been Failed', err, '', '');
                                                                                                                    } else {
                                                                                                                        LanuagetableInsert();
                                                                                                                    }
                                                                                                                } catch (error) {
                                                                                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50515', 'Error while receiving callback from app_system_types table', error, '', '');
                                                                                                                }
                                                                                                            });
                                                                                                        }
                                                                                                    } catch (error) {
                                                                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50516', 'Error while receiving callback from system_types table', error, '', '');
                                                                                                    }
                                                                                                });
                                                                                            }
                                                                                        } catch (error) {
                                                                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50517', 'Error while receiving callback from fx_total_items table', error, '', '');
                                                                                        }
                                                                                    });
                                                                                }
                                                                            } catch (error) {
                                                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50518', 'Error while receiving callback from TOTALAPPST table', error, '', '');
                                                                            }
                                                                        });
                                                                    }
                                                                } catch (error) {
                                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50519', 'Error while receiving callback from app_system_to_system table', error, '', '');
                                                                }
                                                            });
                                                        });
                                                    }
                                                } catch (error) {
                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50520', 'Error while receiving callback from APP_SYSTEM_TO_SYSTEM table', error, '', '');
                                                }
                                            });
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50521', 'Error while receiving callback from TOTALAPPSTS table', error, '', '');
                                    }
                                });
                            }

                            // to get system type code 
                            function getSTCode(pStId, pcallback) {
                                try {
                                    reqDBInstance.GetTableFromFXDB(mCltClient, 'system_types', ['st_code'], {
                                        'st_id': pStId
                                    }, objLogInfo, function (pErr, pRes) {
                                        if (pErr) {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50534', 'Querying system_types table have been Failed', pErr, '', '');
                                        } else {
                                            if (pRes.rows.length) {
                                                pcallback(pRes.rows[0]);
                                            } else {
                                                reqInstanceHelper.PrintInfo(strServiceName, 'system type code not found for this st_id ' + pStId, objLogInfo);
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50535', 'System type entry not found', 'System type entry not found', '', '');
                                            }
                                        }
                                    });
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50543', 'Exception ocuured in getSTCode', error, '', '');
                                }
                            }

                            //language_dictionary_source table insert for transalate
                            function LanuagetableInsert() {
                                try {
                                    reqInstanceHelper.PrintInfo(strServiceName, 'Language dictionary insert started', objLogInfo);
                                    // reqTranDBInstance.GetTranDBConn(mHeaders, false, function (pSession) {
                                    try {
                                        var insertObj = {};
                                        insertObj.CLIENT_ID = Client_id;
                                        insertObj.APP_ID = APP_ID;
                                        insertObj.LD_CODE = Sys_Desc;
                                        insertObj.LDS_GROUP = 'SYSTEM';
                                        insertObj.created_by = U_ID;
                                        insertObj.created_date = reqDateFormater.GetTenantCurrentDateTime(mHeaders, objLogInfo);
                                        reqTranDBInstance.InsertTranDBWithAudit(tran_db_instance, 'language_dictionary_source', [insertObj], objLogInfo, function (result, error) {
                                            if (error) {
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-MIN-50523', 'Error while receiving callback from language_dictionary_source table', error);
                                            } else {
                                                reqInstanceHelper.PrintInfo(strServiceName, 'Language dictionary insert ended.', objLogInfo);
                                                finalres = JSON.stringify("SUCCESS");
                                                reqInstanceHelper.PrintInfo(strServiceName, 'Save system Successfully Done', objLogInfo);
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, finalres, objLogInfo);
                                            }
                                        });
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-MIN-50524', 'Error while receiving callback from language_dictionary_source table', error);
                                    }
                                    // })
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-MIN-50527', 'Error while insert llanguage_dictionary_source table', error);
                                }
                            }
                        });
                    });
                });
            });
        });
    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50522', 'Error in calling SaveSystem API function', error, '', '');
    }
    appResponse.on('close', function () { });
    appResponse.on('finish', function () { });
    appResponse.on('end', function () { });

});
module.exports = router;
/*********** End of Service **********/