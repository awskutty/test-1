var reqExpress = require('express');
var router = reqExpress.Router();
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var strServiceName = 'SaveAppsts';
var reqLINQ = require('node-linq').LINQ;
router.post('/Assignappsts', function (appRequest, appResponse) {
    try {
        var objLogInfo = '';
        var pHeader = appRequest.headers;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            reqTranDBHelper.GetTranDBConn(pHeader, false, function (tran_db_instance) {
                reqAuditLog.GetProcessToken(tran_db_instance, objLogInfo, function (error, prct_id) {
                    try {
                        var pParams = appRequest.body.PARAMS;
                        var APP_ID = pParams.APP_ID || objLogInfo.APP_ID;
                        var U_ID = objLogInfo.USER_ID
                        var ClusterCode = pParams.CLUSTER_CODE;
                        var P_SYS_ID = pParams.PARENT_S_ID;
                        var IsEnabled = pParams.IsEnabled || 'Y'
                        var CLUS_SYSTEM_ID = pParams.CLUS_SYSTEM_ID;
                        var SYS_DESC = pParams.S_DESCRIPTION;
                        var SYS_TYPE_ID = '';
                        var STS_ID = pParams.STS_ID;
                        // var S_CODE = pParams.S_CODE;

                        reqDBInstance.GetFXDBConnection(pHeader, 'clt_cas', objLogInfo, function (DBSession) {
                            try {
                                mainfunction()

                                function getuniqueid(pTableName, pcallback) {
                                    try {
                                        const TOTALAPPSTS = "update fx_total_items set counter_value = counter_value + 1 where code='" + pTableName + "'";
                                        reqDBInstance.ExecuteQuery(DBSession, TOTALAPPSTS, objLogInfo, function callbacktotapp(err) {
                                            try {
                                                reqDBInstance.GetTableFromFXDB(DBSession, 'fx_total_items', ['counter_value'], {
                                                    'code': pTableName
                                                }, objLogInfo, function (error, result) {
                                                    pcallback(result)
                                                })
                                            } catch (error) {
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50521', 'Exception occured ExecuteQuery while getting uniue id function ', error, '', '');
                                            }
                                        })
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50521', 'Exception occured getuniqueid  function ', error, '', '');
                                    }
                                }

                                function mainfunction() {
                                    try {
                                        getuniqueid('APP_SYSTEM_TO_SYSTEM', function (pAppsts) {
                                            try {
                                                var UNIQ_APPSTS_ID = pAppsts.rows[0].counter_value.toString();
                                                getuniqueid('APP_SYSTEM_TYPES', function (pAppst) {
                                                    try {
                                                        var UNIQ_APPST_ID = pAppst.rows[0].counter_value.toString();
                                                        reqInstanceHelper.PrintInfo(strServiceName, 'Querying system_types table', objLogInfo);

                                                        GetsystemInfo(function (pSysInfo) {
                                                            try {
                                                                reqDBInstance.GetTableFromFXDB(DBSession, 'system_types', ['st_description'], {
                                                                    'st_id': pSysInfo.st_id
                                                                }, objLogInfo, function callbackSysType(err, pAppstRow) {
                                                                    try {
                                                                        if (err) {
                                                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50513', 'Error occured query st table ', err, '', '');
                                                                        } else {
                                                                            var St_description = '';
                                                                            St_description = pAppstRow.rows[0].st_description;
                                                                            reqInstanceHelper.PrintInfo(strServiceName, 'Querying app_system_types table', objLogInfo);
                                                                            reqDBInstance.InsertFXDB(DBSession, 'app_system_types', [{
                                                                                'appst_id': UNIQ_APPST_ID,
                                                                                'app_id': APP_ID,
                                                                                'st_description': St_description,
                                                                                'st_id': pSysInfo.st_id,
                                                                                'created_by': U_ID,
                                                                                'created_date': reqDateFormatter.GetTenantCurrentDateTime(pHeader, objLogInfo)
                                                                            }], objLogInfo, function callbackinsapps(err) {
                                                                                try {
                                                                                    if (err) {
                                                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50514', 'Querying app_st table have been Failed', err, '', '');
                                                                                    } else {
                                                                                        reqInstanceHelper.PrintInfo(strServiceName, 'Got result from fx_total_items table', objLogInfo);
                                                                                        reqInstanceHelper.PrintInfo(strServiceName, 'New APPSTS_ID is ' + UNIQ_APPSTS_ID, objLogInfo);
                                                                                        reqInstanceHelper.PrintInfo(strServiceName, 'Querying app_system_to_system table on the Success of fx_total_items table result', objLogInfo);
                                                                                        reqDBInstance.GetTableFromFXDB(DBSession, 'app_system_to_system', ['appsts_id', 'cluster_code', 'parent_s_id', 'child_s_id'], {}, objLogInfo, function (error, result) {
                                                                                            if (error) {
                                                                                                reqInstanceHelper.PrintError(strServiceName, objLogInfo, 'errcode', 'errmsg', error);
                                                                                            } else {
                                                                                                var allSysToSys = result.rows;
                                                                                                var clusterForDelete = new reqLINQ(allSysToSys)
                                                                                                    .Where(function (res) {
                                                                                                        var isToClear = false;
                                                                                                        if (!res.cluster_code && res.child_s_id == CLUS_SYSTEM_ID) {
                                                                                                            isToClear = true;
                                                                                                        }
                                                                                                        return isToClear;
                                                                                                    }).ToArray();
                                                                                                var arrAppStsForDelete = [];
                                                                                                for (var i = 0; i < clusterForDelete.length; i++) {
                                                                                                    arrAppStsForDelete.push(clusterForDelete[i].appsts_id);
                                                                                                }
                                                                                                if (arrAppStsForDelete.length == 0) {
                                                                                                    arrAppStsForDelete = "0"
                                                                                                }
                                                                                                reqDBInstance.DeleteFXDB(DBSession, 'app_system_to_system', {
                                                                                                    'appsts_id': arrAppStsForDelete
                                                                                                }, objLogInfo, function (error) {
                                                                                                    if (error) {
                                                                                                        reqInstanceHelper.PrintError(strServiceName, objLogInfo, 'errcode', 'errmsg', error);
                                                                                                    } else {
                                                                                                        reqInstanceHelper.PrintInfo(strServiceName, 'app_system_to_system Deleted...', objLogInfo);
                                                                                                        getSTCode(pSysInfo.st_id, function (res) {
                                                                                                            reqDBInstance.InsertFXDB(DBSession, 'app_system_to_system', [{
                                                                                                                'appsts_id': UNIQ_APPSTS_ID,
                                                                                                                'app_id': APP_ID,
                                                                                                                'appst_id': UNIQ_APPST_ID,
                                                                                                                'cluster_code': ClusterCode,
                                                                                                                'child_s_id': CLUS_SYSTEM_ID,
                                                                                                                'parent_s_id': P_SYS_ID,
                                                                                                                's_description': SYS_DESC,
                                                                                                                's_id': CLUS_SYSTEM_ID,
                                                                                                                'st_id': pSysInfo.st_id,
                                                                                                                'st_code': res.st_code,
                                                                                                                'sts_id': STS_ID,
                                                                                                                'created_by': U_ID,
                                                                                                                'created_date': reqDateFormatter.GetTenantCurrentDateTime(pHeader, objLogInfo),
                                                                                                                's_code': pSysInfo.s_code,
                                                                                                                'is_enabled': IsEnabled,
                                                                                                                'prct_id': prct_id
                                                                                                            }], objLogInfo, function callbackpappsts(err) {
                                                                                                                try {
                                                                                                                    if (err) {
                                                                                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50510', 'Error occured insert app_system_to_system ', err, '', '');
                                                                                                                    } else {
                                                                                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '', '');
                                                                                                                    }
                                                                                                                } catch (error) {
                                                                                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50519', 'Exception occured while receiving callback from app_system_to_system table', error, '', '');
                                                                                                                }
                                                                                                            })
                                                                                                        })
                                                                                                    }
                                                                                                })
                                                                                            }
                                                                                        })
                                                                                    }
                                                                                } catch (error) {
                                                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50515', 'Exception occured callback asts insert', error, '', '');
                                                                                }
                                                                            })
                                                                        }
                                                                    } catch (error) {
                                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50516', 'Exception occured callback system types', error, '', '');
                                                                    }
                                                                })

                                                            } catch (error) {
                                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50517', 'Exception occured GetsystemInfo', error, '', '');
                                                            }

                                                        })
                                                    } catch (error) {
                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50516', 'Error while getuniqueid APP_SYSTEM_TYPES ', error, '', '');
                                                    }
                                                })

                                            } catch (error) {
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50522', 'appsysinsert function ', error, '', '');
                                            }
                                        })
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50521', 'appsysinsert function ', error, '', '');
                                    }
                                }

                                // to get system type code 
                                function getSTCode(pStId, pcallback) {
                                    try {
                                        reqDBInstance.GetTableFromFXDB(DBSession, 'system_types', ['st_code'], {
                                            'st_id': pStId
                                        }, objLogInfo, function (pErr, pRes) {
                                            if (pErr) {
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51526', 'Querying system_types table have been Failed', pErr, '', '');
                                            } else {
                                                if (pRes.rows.length) {
                                                    pcallback(pRes.rows[0])
                                                } else {
                                                    reqInstanceHelper.PrintInfo(strServiceName, 'system type code not found for this st_id ' + pStId, objLogInfo);
                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50535', 'System type entry not found', 'System type entry not found', '', '');
                                                }
                                            }
                                        })
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51525', 'Exception ocuured in getSTCode', error, '', '');
                                    }
                                }

                                function GetsystemInfo(pcallback) {
                                    try {
                                        var objcond = {};
                                        objcond.S_ID = CLUS_SYSTEM_ID
                                        reqDBInstance.GetTableFromFXDB(DBSession, 'SYSTEMS', [], objcond, objLogInfo, function (err, SysRow) {
                                            try {
                                                if (err) {

                                                } else {
                                                    var sysinfo = {}
                                                    sysinfo.st_id = SysRow.rows[0].st_id
                                                    sysinfo.s_code = SysRow.rows[0].s_code
                                                    pcallback(sysinfo)
                                                }
                                            } catch (error) {
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51523', 'Exception Ocuured GetsystemInfo callback ', error, '', '');
                                            }
                                        })
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51522', 'Exception Ocuured GetsystemInfo ', error, '', '');
                                    }
                                }

                            } catch (error) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51502', 'Exception Ocuured GetFXDBConnection ', error, '', '');
                            }
                        })
                    } catch (error) {
                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51501', 'Exception Ocuured AssignLogInfoDetail ', error, '', '');
                    }
                })
            })
        })
    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-51500', 'Exception Ocuured while saveappsts function ', error, '', '');
    }
})
module.exports = router