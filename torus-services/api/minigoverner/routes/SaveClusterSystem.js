// system_to_system entry only if multi app

var reqExpress = require('express');
var router = reqExpress.Router();
var reqLINQ = require('node-linq').LINQ;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDateFormater = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var strServiceName = 'SaveClusterSystem';
router.post('/SaveClusterSystem', function (appRequest, appResponse) {
    try {
        var objLogInfo = '';
        var pHeader = appRequest.headers;
        reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, sessionInfo) {
            reqTranDBHelper.GetTranDBConn(pHeader, false, function (tran_db_instance) {
                reqAuditLog.GetProcessToken(tran_db_instance, objLogInfo, function (error, prct_id) {
                    reqInstanceHelper.PrintInfo(strServiceName, 'SaveCluster Service Begin', objLogInfo);
                    var blnIsMultiapp = sessionInfo.IS_MULTIAPP;
                    objLogInfo.HANDLER_CODE = 'SaveClusterSystem';
                    objLogInfo.PROCESS = 'SaveCluster-MiniGoverner';
                    objLogInfo.ACTION_DESC = 'SaveClusterSystem';
                    var U_ID = objLogInfo.USER_ID;
                    var allParams = appRequest.body.PARAMS;
                    var APP_ID = allParams.APP_ID || objLogInfo.APP_ID;


                    reqDBInstance.GetFXDBConnection(pHeader, 'clt_cas', objLogInfo, function (DBSession) {
                        var count = 0;
                        if (allParams.length > count) {
                            saveCluster(allParams[count]);
                        }
                        function saveCluster(pParams) {
                            count++
                            try {
                                var ClusterCode = pParams.CLUSTER_CODE;
                                var ClustParentSys_id = pParams.CLUS_PARENT_SYS;
                                var IsEnabled = pParams.IsEnabled
                                var ClusSys_id = pParams.CLUS_SYSTEM;
                                var Isupdate = pParams.IsUpdate;
                                var AppSTSID = pParams.APPSTSID;
                                var UNIQ_STS_ID = ''
                                var Syscond = [];
                                if (ClustParentSys_id != undefined) {
                                    Syscond.push(ClustParentSys_id);
                                } else {
                                    ClustParentSys_id = '0';
                                }
                                if (ClusSys_id != undefined) {
                                    Syscond.push(ClusSys_id)
                                }
                                if (Isupdate == "N") {
                                    reqDBInstance.GetTableFromFXDB(DBSession, 'systems', [], {
                                        s_id: Syscond
                                    }, objLogInfo, function (Err, Res) {
                                        if (Err) {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Error occured get increment total items ', Err, '', '');
                                        } else {
                                            for (i = 0; i < Res.rows.length; i++) {
                                                if (ClustParentSys_id == Res.rows[i].s_id) {
                                                    var ParentSys_Code = Res.rows[i].s_code;
                                                    var ParentSys_Desc = Res.rows[i].s_description;
                                                } else if (ClusSys_id == Res.rows[i].s_id) {
                                                    var ChildSys_Code = Res.rows[i].s_code;
                                                    var ChildSys_Desc = Res.rows[i].s_description;
                                                    var Sys_Type_id = Res.rows[i].st_id;
                                                }
                                            }
                                            reqDBInstance.GetTableFromFXDB(DBSession, 'system_to_system', ['cluster_code', 'parent_s_id '], {
                                                'cluster_code': ClusterCode
                                            }, objLogInfo, function (pErr, pResult) {
                                                if (pErr) {
                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Error occured get system_to_system  ', pErr, '', '');
                                                } else {
                                                    var Blnexit = false;
                                                    for (j = 0; j < pResult.rows.length; j++) {
                                                        if (pResult.rows[j].parent_s_id != '0' && ClustParentSys_id != '0') {
                                                            //var Blnexit = true;
                                                            break;
                                                        } else {
                                                            continue;
                                                        }
                                                    }
                                                    if (Blnexit) {
                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, 'Cluster has the Parent System,This is system must be a child. Please select Parent System.', objLogInfo, '', '', '', '', '');
                                                    } else {
                                                        const SYSTOSYS = 'update fx_total_items set counter_value = counter_value + 1 where code=\'SYSTEM_TO_SYSTEM\'';
                                                        try {
                                                            reqInstanceHelper.PrintInfo(strServiceName, 'Querying SYSTOSYS table', objLogInfo);
                                                            reqDBInstance.ExecuteQuery(DBSession, SYSTOSYS, objLogInfo, function callbackuptotsystosys(err) {
                                                                try {
                                                                    if (err) {
                                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-AUT-11402', 'Error while Querying SYSTOSYS table', err, '', '');
                                                                    } else {
                                                                        reqInstanceHelper.PrintInfo(strServiceName, 'Querying fx_total_items table on the success of SYSTOSYS table', objLogInfo);
                                                                        reqDBInstance.GetTableFromFXDB(DBSession, 'fx_total_items', ['counter_value'], {
                                                                            'code': 'SYSTEM_TO_SYSTEM'
                                                                        }, objLogInfo, function callbackstscount(err, result) {
                                                                            try {
                                                                                if (err) {
                                                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-AUT-11402', 'Error while Querying fx_total_items table', err, '', '');
                                                                                } else {
                                                                                    reqInstanceHelper.PrintInfo(strServiceName, 'Got result from fx_total_items table', objLogInfo);
                                                                                    UNIQ_STS_ID = result.rows[0].counter_value.toString()
                                                                                    reqInstanceHelper.PrintInfo(strServiceName, 'Querying  system_to_system table', objLogInfo);

                                                                                    reqDBInstance.GetTableFromFXDB(DBSession, 'system_to_system', ['sts_id', 'cluster_code', 'parent_s_id', 'child_s_id'], {}, objLogInfo, function (error, result) {
                                                                                        if (error) {
                                                                                            reqInstanceHelper.PrintError(strServiceName, objLogInfo, 'errcode', 'errmsg', error);
                                                                                        } else {
                                                                                            var allSysToSys = result.rows;
                                                                                            var clusterForDelete = new reqLINQ(allSysToSys)
                                                                                                .Where(function (res) {
                                                                                                    var isToClear = false;
                                                                                                    if (!res.cluster_code && res.child_s_id == ClusSys_id) {
                                                                                                        isToClear = true;
                                                                                                    }
                                                                                                    return isToClear;
                                                                                                }).ToArray();
                                                                                            var arrStsForDelete = [];
                                                                                            for (var i = 0; i < clusterForDelete.length; i++) {
                                                                                                arrStsForDelete.push(clusterForDelete[i].sts_id);
                                                                                            }
                                                                                            reqDBInstance.DeleteFXDB(DBSession, 'system_to_system', {
                                                                                                'sts_id': arrStsForDelete
                                                                                            }, objLogInfo, function (error) {
                                                                                                if (error) {
                                                                                                    reqInstanceHelper.PrintError(strServiceName, objLogInfo, 'errcode', 'errmsg', error);
                                                                                                } else {
                                                                                                    reqInstanceHelper.PrintInfo(strServiceName, 'system_to_system Deleted...', objLogInfo);
                                                                                                }
                                                                                            });
                                                                                        }
                                                                                    });

                                                                                    reqDBInstance.InsertFXDB(DBSession, 'system_to_system', [{
                                                                                        'sts_id': UNIQ_STS_ID,
                                                                                        'cluster_code': ClusterCode,
                                                                                        'parent_s_id': ClustParentSys_id,
                                                                                        'child_s_id': ClusSys_id,
                                                                                        'child_s_description': ChildSys_Desc,
                                                                                        'created_by': U_ID,
                                                                                        'prct_id': prct_id,
                                                                                        'created_date': reqDateFormater.GetTenantCurrentDateTime(pHeader, objLogInfo)
                                                                                    }], objLogInfo, function callbackinssts(err) {
                                                                                        try {
                                                                                            if (err) {
                                                                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-AUT-11422', 'Error while Querying system_to_system table', err, 'FAILURE', '');
                                                                                            } else {
                                                                                                reqInstanceHelper.PrintInfo(strServiceName, 'System saved successfully', objLogInfo);
                                                                                                if (allParams.length > count && blnIsMultiapp == "Y") {
                                                                                                    saveCluster(allParams[count]);
                                                                                                } else if (blnIsMultiapp == "Y") {
                                                                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '', '');
                                                                                                } else {
                                                                                                    appsysinsert()
                                                                                                }
                                                                                            }
                                                                                        } catch (error) {
                                                                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-AUT-11402', 'Error in receiving system_to_system callback ', error, '', '');
                                                                                        }
                                                                                    })
                                                                                }
                                                                            } catch (error) {
                                                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-AUT-11421', 'Error in  receiving fx_total_items callback ', error, '', '');
                                                                            }
                                                                        })
                                                                    }
                                                                } catch (error) {
                                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-AUT-11422', 'Error in  receiving SYSTOSYS callback ', error, '', '');
                                                                }
                                                            })

                                                        } catch (error) {
                                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-AUT-11423', 'Error in calling GetStsCount', error, '', '');
                                                        }
                                                    }
                                                }
                                            })

                                            function appsysinsert() {
                                                const TOTALAPPSTS = 'update fx_total_items set counter_value = counter_value + 1 where code=\'APP_SYSTEM_TO_SYSTEM\'';
                                                reqInstanceHelper.PrintInfo(strServiceName, 'Querying TOTALAPPSTS table', objLogInfo);
                                                reqDBInstance.ExecuteQuery(DBSession, TOTALAPPSTS, objLogInfo, function callbacktotapp(err) {
                                                    try {
                                                        if (err) {
                                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50508', 'Querying TOTALAPPSTS table have been Failed', err, '', '');

                                                        } else {
                                                            reqInstanceHelper.PrintInfo(strServiceName, 'Querying fx_total_items table on the Success of TOTALAPPSTS table result', objLogInfo);
                                                            reqDBInstance.GetTableFromFXDB(DBSession, 'fx_total_items', ['counter_value'], {
                                                                'code': 'APP_SYSTEM_TO_SYSTEM'
                                                            }, objLogInfo, function callbackappsts(err, result) {
                                                                try {
                                                                    if (err) {
                                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50509', 'Querying fx_total_items table have been Failed', err, '', '');

                                                                    } else {
                                                                        const TOTALAPPST = 'update fx_total_items set counter_value = counter_value + 1 where code=\'APP_SYSTEM_TYPES\'';
                                                                        reqDBInstance.ExecuteQuery(DBSession, TOTALAPPST, objLogInfo, function (err) {
                                                                            if (err) {
                                                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50519', 'update fx_total_items table have been Failed', err, '', '');
                                                                            } else {
                                                                                reqInstanceHelper.PrintInfo(strServiceName, 'Querying fx_total_items table on the Success of TOTALAPPST table result', objLogInfo);
                                                                                reqDBInstance.GetTableFromFXDB(DBSession, 'fx_total_items', ['counter_value'], {
                                                                                    'code': 'APP_SYSTEM_TYPES'
                                                                                }, objLogInfo, function callbackappstt(err, rest) {
                                                                                    try {
                                                                                        if (err) {
                                                                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50512', 'Querying fx_total_items table have been Failed', err, '', '');
                                                                                        } else {
                                                                                            reqInstanceHelper.PrintInfo(strServiceName, 'Got result from fx_total_items table', objLogInfo);
                                                                                            var UNIQ_APPST_ID = rest.rows[0].counter_value.toString();
                                                                                            console.log('UNIQ_APPST_ID is' + UNIQ_APPST_ID);
                                                                                            reqInstanceHelper.PrintInfo(strServiceName, 'New APPST_ID is ' + UNIQ_APPST_ID, objLogInfo);
                                                                                            reqInstanceHelper.PrintInfo(strServiceName, 'Querying system_types table', objLogInfo);
                                                                                            reqDBInstance.GetTableFromFXDB(DBSession, 'system_types', ['st_description'], {
                                                                                                'st_id': Sys_Type_id
                                                                                            }, objLogInfo, function callbackSysType(err, reslt) {
                                                                                                try {
                                                                                                    if (err) {
                                                                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50513', 'Querying system_types table have been Failed', err, '', '');
                                                                                                    } else {
                                                                                                        var St_description = '';
                                                                                                        St_description = reslt.rows[0].st_description;
                                                                                                        reqInstanceHelper.PrintInfo(strServiceName, 'Querying app_system_types table', objLogInfo);
                                                                                                        reqDBInstance.InsertFXDB(DBSession, 'app_system_types', [{
                                                                                                            'appst_id': UNIQ_APPST_ID,
                                                                                                            'app_id': APP_ID,
                                                                                                            'st_description': St_description,
                                                                                                            'st_id': Sys_Type_id,
                                                                                                            'created_by': U_ID,
                                                                                                            'created_date': reqDateFormater.GetTenantCurrentDateTime(pHeader, objLogInfo)
                                                                                                        }], objLogInfo, function callbackinsapps(err) {
                                                                                                            try {
                                                                                                                if (err) {
                                                                                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50514', 'Querying app_system_types table have been Failed', err, '', '');
                                                                                                                } else {
                                                                                                                    reqInstanceHelper.PrintInfo(strServiceName, 'Got result from fx_total_items table', objLogInfo);
                                                                                                                    var UNIQ_APPSTS_ID = result.rows[0].counter_value.toString();
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
                                                                                                                                    if (!res.cluster_code && res.child_s_id == ClusSys_id) {
                                                                                                                                        isToClear = true;
                                                                                                                                    }
                                                                                                                                    return isToClear;
                                                                                                                                }).ToArray();
                                                                                                                            var arrAppStsForDelete = [];
                                                                                                                            for (var i = 0; i < clusterForDelete.length; i++) {
                                                                                                                                arrAppStsForDelete.push(clusterForDelete[i].appsts_id);
                                                                                                                            }
                                                                                                                            reqDBInstance.DeleteFXDB(DBSession, 'app_system_to_system', {
                                                                                                                                'appsts_id': arrAppStsForDelete
                                                                                                                            }, objLogInfo, function (error) {
                                                                                                                                if (error) {
                                                                                                                                    reqInstanceHelper.PrintError(strServiceName, objLogInfo, 'errcode', 'errmsg', error);
                                                                                                                                } else {
                                                                                                                                    reqInstanceHelper.PrintInfo(strServiceName, 'app_system_to_system Deleted...', objLogInfo);
                                                                                                                                }
                                                                                                                            });
                                                                                                                        }
                                                                                                                    });
                                                                                                                    getSTCode(Sys_Type_id, function (res) {
                                                                                                                        reqDBInstance.InsertFXDB(DBSession, 'app_system_to_system', [{
                                                                                                                            'appsts_id': UNIQ_APPSTS_ID,
                                                                                                                            'app_id': APP_ID,
                                                                                                                            'appst_id': UNIQ_APPST_ID,
                                                                                                                            'cluster_code': ClusterCode,
                                                                                                                            'child_s_id': ClusSys_id,
                                                                                                                            'parent_s_id': ClustParentSys_id,
                                                                                                                            's_description': ChildSys_Desc,
                                                                                                                            's_id': ClusSys_id,
                                                                                                                            'st_id': Sys_Type_id,
                                                                                                                            'st_code': res.st_code,
                                                                                                                            'sts_id': UNIQ_STS_ID,
                                                                                                                            'created_by': U_ID,
                                                                                                                            'created_date': reqDateFormater.GetTenantCurrentDateTime(pHeader, objLogInfo),
                                                                                                                            's_code': ChildSys_Code,
                                                                                                                            'prct_id': prct_id,
                                                                                                                            'is_enabled': IsEnabled
                                                                                                                        }], objLogInfo, function callbackpappsts(err) {
                                                                                                                            try {
                                                                                                                                if (err) {
                                                                                                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50510', 'Querying TOTALAPPSTS table have been Failed', err, '', '');
                                                                                                                                } else {
                                                                                                                                    if (allParams.length > count) {
                                                                                                                                        saveCluster(allParams[count]);
                                                                                                                                    } else {
                                                                                                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '', '');
                                                                                                                                    }
                                                                                                                                }
                                                                                                                            } catch (error) {
                                                                                                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50519', 'Error while receiving callback from app_system_to_system table', error, '', '');
                                                                                                                            }
                                                                                                                        })
                                                                                                                    })
                                                                                                                }
                                                                                                            } catch (error) {
                                                                                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50515', 'Error while receiving callback from app_system_types table', error, '', '');
                                                                                                            }
                                                                                                        })
                                                                                                    }
                                                                                                } catch (error) {
                                                                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50516', 'Error while receiving callback from system_types table', error, '', '');
                                                                                                }
                                                                                            })
                                                                                        }

                                                                                        // to get system type code 
                                                                                        function getSTCode(pStId, pcallback) {
                                                                                            try {
                                                                                                reqDBInstance.GetTableFromFXDB(DBSession, 'system_types', ['st_code'], {
                                                                                                    'st_id': pStId
                                                                                                }, objLogInfo, function (pErr, pRes) {
                                                                                                    if (pErr) {
                                                                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50527', 'Querying system_types table have been Failed', pErr, '', '');
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
                                                                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50528', 'Exception ocuured in getSTCode', error, '', '');
                                                                                            }
                                                                                        }
                                                                                    } catch (error) {
                                                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50517', 'Error while receiving callback from fx_total_items table', error, '', '');
                                                                                    }
                                                                                })
                                                                            }
                                                                        })

                                                                    }
                                                                } catch (error) {
                                                                    reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50520', 'Error while receiving callback from APP_SYSTEM_TO_SYSTEM table', error, '', '');
                                                                }
                                                            })
                                                        }
                                                    } catch (error) {
                                                        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50521', 'Error while receiving callback from TOTALAPPSTS table', error, '', '');
                                                    }
                                                })
                                            }
                                        }
                                    })
                                } else {
                                    var cond = {}
                                    cond.appsts_id = AppSTSID;
                                    cond.cluster_code = ClusterCode;
                                    cond.app_id = APP_ID;
                                    cond.prct_id = prct_id;

                                    reqDBInstance.UpdateFXDB(DBSession, 'app_system_to_system', { 'is_enabled': IsEnabled }, cond, objLogInfo, function (err, Res) {
                                        if (err) {
                                            reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-50511', 'Update  appsts  Failed', err, '', '');
                                        } else {
                                            if (allParams.length > count) {
                                                saveCluster(allParams[count]);
                                            } else {
                                                reqInstanceHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '', '', '');
                                            }
                                        }
                                    })
                                }
                            } catch (error) {
                                reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured while connecting DB GetFXDBConnection', error, '', '');
                            }
                        }
                    });
                });
            });

        });
    } catch (error) {
        reqInstanceHelper.SendResponse(strServiceName, appResponse, '', objLogInfo, 'ERR-MIN-', 'Exception Ocuured while SaveCluster function ', error, '', '');
    }
});
module.exports = router;
