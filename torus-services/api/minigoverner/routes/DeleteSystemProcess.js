/*
    @Api_Name : /DeleteSystemProcess,
    @Description: To Delete System Process
    @Last Error Code : 'ERR-MIN-52050'
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLINQ = require('node-linq').LINQ;
var serviceName = 'DeleteSystemProcess';

// Host api to server
router.post('/DeleteSystemProcess', function (appRequest, appResposnse) {
    var objLogInfo;
    var mSession = null;

    //this will call when unexpected close or finish
    function finishApiCall() {
        if (mSession) {
            reqTranDBInstance.CallRollback(mSession);
        }
    }
    reqLogInfo.AssignLogInfoDetail(appRequest, function (objLogInfo, objSessionInfo) {
        try {
            objLogInfo.HANDLER_CODE = 'DeleteSystemProcess'; //correct it
            var Ismultiapp = objSessionInfo.IS_MULTIAPP;
            var CLIENT_ID = objSessionInfo.CLIENT_ID;
            var SYS_TYPE_ID = '';
            appResposnse.on('close', function () {
                finishApiCall(appResposnse);
            });
            appResposnse.on('finish', function () {
                finishApiCall(appResposnse);
            });
            appResposnse.on('end', function () {
                finishApiCall(appResposnse);
            });
            reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo);
            // var params = appRequest.body.PARAMS;
            var headers = appRequest.headers;
            var sessionInfoKeys = Object.keys(objSessionInfo);
            // This loop is for merge session values with params
            // for (var i = 0; i < sessionInfoKeys.length; i++) {
            //     var currentKey = sessionInfoKeys[i];
            //     params[currentKey] = objSessionInfo[currentKey];
            // }
            reqFXDBInstance.GetFXDBConnection(headers, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pCltClient) {
                try {
                    var mClient = pCltClient;
                    var strClientId = CLIENT_ID;
                    var strAppId = appRequest.body.PARAMS.APP_ID;
                    var strSystemDelete = appRequest.body.PARAMS.SYSTEM_DELETE;
                    var strAppSTSId = appRequest.body.PARAMS.APPSTS_ID;
                    var strClusterCode = appRequest.body.PARAMS.CLUSTER_CODE || '';
                    var strSysId = appRequest.body.PARAMS.S_ID;
                    var strResult = {};
                    var strSID = '';
                    var k = 0;
                    var arrSysId = [];
                    var cond = {
                        'appsts_id': strAppSTSId
                    }
                    reqInstanceHelper.PrintInfo(serviceName, 'Multi app  = ' + Ismultiapp, objLogInfo);
                    if (Ismultiapp == 'Y') {
                        checkappsts()
                    } else {
                        checkappusts()
                    }

                    function checkappusts() {
                        try {

                            reqInstanceHelper.PrintInfo(serviceName, 'check app user sts', objLogInfo);
                            reqFXDBInstance.GetTableFromFXDB(pCltClient, 'app_user_sts', [], cond, objLogInfo, function (err, Result) {
                                if (err) {
                                    reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52003', 'Error in _SelSysToSys function', err);
                                } else {
                                    if (Result.rows.length > 0) {
                                        strResult.selectedCluster = strClusterCode;
                                        strResult.status = 'System assigned to users. Delete not allowed.';
                                        reqInstanceHelper.PrintInfo(serviceName, strResult.status, objLogInfo);
                                        reqInstanceHelper.SendResponse(serviceName, appResposnse, strResult, objLogInfo, '', '', '', 'SUCCESS', '');
                                    } else {
                                        checkappsts()
                                    }
                                }
                            })
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52052', 'Exception occred checkappsts', error);
                        }
                    }

                    function checkappsts() {
                        reqInstanceHelper.PrintInfo(serviceName, 'check app sts', objLogInfo);
                        reqFXDBInstance.GetTableFromFXDB(pCltClient, 'APP_SYSTEM_TO_SYSTEM', [], {}, objLogInfo, function (pErr, pRes) {
                            try {
                                if (pErr) {
                                    reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52055', 'Error occured query sts', pErr);
                                } else {
                                    var AppStsInfo = new reqLINQ(pRes.rows)
                                        .Where(function (res) {
                                            return res.s_id == strSysId && res.cluster_code !== '';
                                        }).ToArray();
                                    if (AppStsInfo.length) {
                                        strResult.status = 'System assigned to Application. Delete not allowed.'
                                        reqInstanceHelper.PrintInfo(serviceName, strResult.status, objLogInfo);
                                        reqInstanceHelper.SendResponse(serviceName, appResposnse, strResult, objLogInfo, '', '', '', 'FAILURE', '');
                                    } else {
                                        checksts();
                                    }
                                }
                            } catch (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52055', 'Exception occured query sts', error);
                            }
                        });
                    }





                    function checksts() {
                        try {
                            reqInstanceHelper.PrintInfo(serviceName, 'check sts', objLogInfo);
                            reqFXDBInstance.GetTableFromFXDB(mClient, 'system_to_system', ['sts_id', 'cluster_code', 'parent_s_id', 'child_s_id'], {}, objLogInfo, function (Err, pRes) {
                                if (Err) {
                                    reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52057', 'Error occured query sts', Err);
                                } else {
                                    var StsInfo = new reqLINQ(pRes.rows)
                                        .Where(function (res) {
                                            return res.child_s_id == strSysId && res.cluster_code !== '';
                                        }).ToArray();
                                    if (StsInfo.length) {
                                        strResult.status = 'System assigned to cluster. Delete not allowed.'
                                        reqInstanceHelper.PrintInfo(serviceName, strResult.status, objLogInfo);
                                        reqInstanceHelper.SendResponse(serviceName, appResposnse, strResult, objLogInfo, '', '', '', 'FAILURE', '');
                                    } else {
                                        DeleteSysFrmSTTragetTable({}, function () {
                                            if (Ismultiapp == 'Y') {
                                                deletesystem();
                                            } else {
                                                _MainDelProcess();
                                            }
                                        });
                                    }
                                }
                            })
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52056', 'Exception occured checksts', error);
                        }
                    }


                    function deletesystem() {
                        try {
                            reqInstanceHelper.PrintInfo(serviceName, 'delete system called', objLogInfo);
                            getsysinfo(function (Stid) {
                                var Delcond = {};
                                Delcond.CLIENT_ID = strClientId;
                                Delcond.S_ID = strSysId;
                                Delcond.ST_ID = Stid;
                                reqFXDBInstance.DeleteFXDB(mClient, 'SYSTEMS', Delcond, objLogInfo, function (err, Res) {
                                    try {
                                        if (err) {
                                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52059', 'Error occured delete sts', err);
                                        } else {
                                            strResult.status = 'SUCCESS'
                                            _Response()
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52058', 'Exception occured delete callback ', error);
                                    }
                                })
                            })
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52056', 'Exception occured deletesystem', error);
                        }
                    }


                    function getsysinfo(pcallback) {
                        try {
                            reqInstanceHelper.PrintInfo(serviceName, 'get system info', objLogInfo);
                            var objcond = {}
                            objcond.s_id = strSysId
                            reqFXDBInstance.GetTableFromFXDB(mClient, 'SYSTEMS', [], objcond, objLogInfo, function (perr, SysRow) {
                                try {
                                    if (perr) {
                                        reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52060', 'Error occured getsysinfo sts', perr);
                                    } else {
                                        var StId = SysRow.rows[0].st_id;
                                        pcallback(StId)
                                    }
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52061', 'Exception occured getsysinfo callback', error);
                                }
                            })
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52062', 'Exception occured getsysinfo', error);
                        }
                    }

                    function _MainDelProcess() {
                        try {
                            reqInstanceHelper.PrintInfo(serviceName, '_MainDelProcess called', objLogInfo);
                            if (strSystemDelete == 'N') {
                                _DelAPPSTSROLES(strAppSTSId);
                            } else if (strSystemDelete == 'Y') {
                                _SelSysToSys(strSysId);
                            }
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52002', 'Error in _MainDelProcess function', error);
                        }
                    }

                    // Do the system to system select
                    function _SelSysToSys(pSID) {
                        try {
                            reqFXDBInstance.GetTableFromFXDB(mClient, 'system_to_system', ['sts_id', 'cluster_code', 'parent_s_id', 'child_s_id'], {
                                'cluster_code': strClusterCode,
                                'parent_s_id': pSID
                            }, objLogInfo, function callbackSelSTS(pError, pResult) {
                                try {
                                    if (pError) {
                                        reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52003', 'Error in _SelSysToSys function', error);
                                    } else if (pResult) {
                                        strSID = pSID;
                                        if (pResult.rows.length > 0) {
                                            for (i = 0; i < pResult.rows.length; i++) {
                                                strSID = pResult.rows[i].child_s_id;
                                                arrSysId.push(strSID);
                                                return _SelSysToSys(strSID);
                                            }
                                        }
                                        if (arrSysId.length == 0) {
                                            _SelSystemToSystem();
                                        }
                                        if (arrSysId.length > 0) {
                                            strResult.status = 'SUCCESS';
                                            _SelectAppSTS(arrSysId);
                                        }
                                    }
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52004', 'Error in _SelSysToSys function', error);
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52005', 'Error in _SelSysToSys function', error);
                        }
                    }

                    // Do the app system to system select
                    function _SelectAppSTS(pArrSId) {
                        try {
                            reqFXDBInstance.GetTableFromFXDB(mClient, 'app_system_to_system', ['appsts_id', 'child_s_id', 's_id'], {
                                'cluster_code': strClusterCode,
                                'app_id': strAppId
                            }, objLogInfo, function callbackSelAPPSYS(pError, pResult) {
                                try {
                                    if (pError) {
                                        reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52006', 'Error in _SelectAppSTS function', pError);
                                    } else if (pResult) {
                                        var arrAppStsId = [];
                                        if (pResult.rows.length > 0) {
                                            if (pArrSId.length > 0) {
                                                for (i = 0; i < pArrSId.length; i++) {
                                                    for (j = 0; j < pResult.rows.length; j++) {
                                                        if (pResult.rows[j].s_id == pArrSId[i]) {
                                                            arrAppStsId.push(pResult.rows[j].appsts_id);
                                                        }
                                                    }
                                                }
                                            }
                                            strResult.status = 'SUCCESS';
                                            _DeleteSystemProcess(arrAppStsId, pArrSId);
                                        }
                                    }
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52007', 'Error in _SelectAppSTS function', error);
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52008', 'Error in _SelectAppSTS function', error);
                        }
                    }

                    function DeleteSysFrmSTTragetTable(params, DeleteSysFrmSTTragetTableCB) {
                        try {
                            reqFXDBInstance.GetTableFromFXDB(mClient, 'systems', [], {
                                's_id': strSysId
                            }, objLogInfo, function (pErr, pRes) {
                                if (pErr) {
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-MIN-52050', 'Error while Querying systems Table with S_ID - ' + strSysId, pErr);
                                    DeleteSysFrmSTTragetTableCB(pErr, null);
                                } else {
                                    if (pRes.rows.length) {
                                        SYS_TYPE_ID = pRes.rows[0].st_id;
                                        reqFXDBInstance.GetTableFromFXDB(mClient, 'system_types', ['target_table'], {
                                            'st_id': SYS_TYPE_ID
                                        }, objLogInfo, function (pErr, pRes) {
                                            if (pErr) {
                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-MIN-52049', 'Error while Querying system_types Table with ST_ID - ' + SYS_TYPE_ID, pErr);
                                                DeleteSysFrmSTTragetTableCB(pErr, null);
                                            } else {
                                                if (pRes.rows.length) {
                                                    var SystemTypeTargetTable = pRes.rows[0].target_table;
                                                    if (SystemTypeTargetTable) {
                                                        var condObj = {
                                                            s_id: strSysId
                                                        };
                                                        reqTranDBInstance.GetTranDBConn(headers, false, function (tran_db_instance) {
                                                            reqTranDBInstance.DeleteTranDB(tran_db_instance, SystemTypeTargetTable, condObj, objLogInfo, function (pResult, pError) {
                                                                if (pError) {
                                                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-MIN-52047', SystemTypeTargetTable + ' Target Table System Delete Process Failed... ', pError);
                                                                } else {
                                                                    reqInstanceHelper.PrintInfo(serviceName, SystemTypeTargetTable + ' Target Table System Delete Process Completed Successfully', objLogInfo);
                                                                }
                                                                DeleteSysFrmSTTragetTableCB(pError, pResult);
                                                            });
                                                        });
                                                    } else {
                                                        reqInstanceHelper.PrintInfo(serviceName, 'There is No Target Table for System Type ID - ' + SYS_TYPE_ID, objLogInfo);
                                                        DeleteSysFrmSTTragetTableCB(null, null);
                                                    }
                                                } else {
                                                    reqInstanceHelper.PrintInfo(serviceName, 'There is No Record for System Type ID - ' + SYS_TYPE_ID, objLogInfo);
                                                    DeleteSysFrmSTTragetTableCB(null, null);
                                                }
                                            }
                                        });
                                    } else {
                                        reqInstanceHelper.PrintInfo(serviceName, 'There is No Record for System ID - ' + strSysId, objLogInfo);
                                        DeleteSysFrmSTTragetTableCB(null, null);
                                    }
                                }
                            });

                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'ERR-MIN-52048', 'Catch Error in DeleteSysFrmSTTragetTable()... ', error);
                            DeleteSysFrmSTTragetTableCB(error, null);
                        }
                    }



                    // Do the app system to system roles delete
                    function _DeleteSystemProcess(arrAppStsId, pArrSId) {
                        try {
                            if (strSystemDelete == 'Y' || strSystemDelete == 'N') {
                                if (arrAppStsId.length > 0) {
                                    for (k = 0; k < arrAppStsId.length; k++) {
                                        var strAppStsId = arrAppStsId[k];
                                        reqFXDBInstance.DeleteFXDB(mClient, 'app_system_to_system_roles', {
                                            'appsts_id': strAppStsId
                                        }, objLogInfo, function callbackDelAppSTS(pErr, pResult) {
                                            if (pErr) {
                                                reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52009', 'Error in _DeleteSystemProcess function', error);
                                                // console.error(pErr);
                                            } else if (pResult) {
                                                strResult.status = 'SUCCESS';
                                            }
                                        });
                                    }
                                    _DeleteAppSystemToSystem(arrAppStsId, pArrSId);
                                }
                            }
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52010', 'Error in _DeleteSystemProcess function', error);
                        }
                    }

                    // Do the app system to system delete
                    function _DeleteAppSystemToSystem(arrAppStsId, pArrSId) {
                        try {
                            var strAppSTSLength = 0;
                            if (arrAppStsId.length > 0) {
                                strAppSTSLength = arrAppStsId.length;
                                for (m = 0; m < arrAppStsId.length; m++) {
                                    var strAppStsId = arrAppStsId[m];
                                    reqFXDBInstance.DeleteFXDB(mClient, 'app_system_to_system', {
                                        'appsts_id': strAppStsId
                                    }, objLogInfo, function callbackDelSTS(pError, pResult) {
                                        try {
                                            if (pError) {
                                                reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52011', 'Error in _DeleteAppSystemToSystem function', error);
                                            } else if (pResult) {
                                                strResult.status = 'SUCCESS';
                                            }
                                        } catch (error) {
                                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52012', 'Error in _DeleteAppSystemToSystem function', error);
                                        }
                                    });
                                }
                            }
                            if (strSystemDelete == 'Y') {
                                _SelectSystemToSystem(pArrSId);
                            }
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52013', 'Error in _DeleteAppSystemToSystem function', error);
                        }
                    }

                    // Do the system to system select
                    function _SelectSystemToSystem(pArrSId) {
                        try {
                            reqFXDBInstance.GetTableFromFXDB(mClient, 'system_to_system', ['sts_id', 'parent_s_id', 'child_s_id', 'cluster_code'], {
                                'cluster_code': strClusterCode
                            }, objLogInfo, function callbackSelSTS(pError, pResult) {
                                try {
                                    if (pError) {
                                        reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52014', 'Error in _SelectSystemToSystem function', error);
                                    } else if (pResult) {
                                        var arrStsId = [];
                                        if (pResult.rows.length > 0) {
                                            if (pArrSId.length > 0) {
                                                for (n = 0; n < pArrSId.length; n++) {
                                                    for (q = 0; q < pResult.rows.length; q++) {
                                                        if (pResult.rows[q].child_s_id == pArrSId[n]) {
                                                            arrStsId.push(pResult.rows[q].sts_id);
                                                        }
                                                    }
                                                }
                                            }
                                            strResult.status = 'SUCCESS';
                                            _DeleteSystemToSystem(arrStsId, pArrSId);
                                        }
                                    }
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52015', 'Error in _SelectSystemToSystem function', error);
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52016', 'Error in _SelectSystemToSystem function', error);
                        }
                    }

                    // Do the system to system delete
                    function _DeleteSystemToSystem(arrStsId, pArrSId) {
                        try {
                            if (arrStsId.length > 0) {
                                for (i = 0; i < arrStsId.length; i++) {
                                    var strStsId = arrStsId[i];
                                    reqFXDBInstance.DeleteFXDB(mClient, 'system_to_system', {
                                        'sts_id': strStsId
                                    }, objLogInfo, function callbackDelSess(pError, pResult) {
                                        try {
                                            if (pError) {
                                                reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52017', 'Error in _DeleteSystemToSystem function', error);
                                            } else if (pResult) {
                                                strResult.status = 'SUCCESS';
                                            }
                                        } catch (error) {
                                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52018', 'Error in _DeleteSystemToSystem function', error);
                                        }
                                    });
                                }
                            }
                            _SelectSystems(pArrSId);
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52019', 'Error in _DeleteSystemToSystem function', error);
                        }
                    }
                    // Do the systems select
                    function _SelectSystems(pArrSId) {
                        try {
                            var arrStId = [];
                            if (pArrSId.length > 0) {
                                for (i = 0; i < pArrSId.length; i++) {
                                    var strSId = pArrSId[i];
                                    reqFXDBInstance.GetTableFromFXDB(mClient, 'systems', ['s_id', 'st_id'], {
                                        's_id': strSId
                                    }, objLogInfo, function callbackSelSYS(pError, pResult) {
                                        try {
                                            if (pError) {
                                                reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52020', 'Error in _SelectSystems function', error);
                                            } else if (pResult) {
                                                if (pResult.rows.length > 0) {
                                                    for (j = 0; j < pResult.rows.length; j++) {
                                                        arrStId.push(pResult.rows[j]);
                                                    }
                                                    strResult.status = 'SUCCESS';
                                                    if (arrStId.length > 0) {
                                                        _DeleteSystems(arrStId);
                                                    }
                                                }
                                            }
                                        } catch (error) {
                                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52021', 'Error in _SelectSystems function', error);
                                        }
                                    });
                                }
                            }
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52022', 'Error in _SelectSystems function', error);
                        }
                    }
                    // Do the systems delete
                    function _DeleteSystems(arrStId) {
                        try {
                            var strLength = 0;
                            if (arrStId.length > 0) {
                                strLength = arrStId.length;
                                reqInstanceHelper.PrintInfo(serviceName, '_DeleteSystems called', objLogInfo);
                                for (i = 0; i < arrStId.length; i++) {
                                    var strStId = arrStId[i].st_id;
                                    var strSId = arrStId[i].s_id;
                                    reqFXDBInstance.DeleteFXDB(mClient, 'systems', {
                                        'st_id': strStId,
                                        's_id': strSId,
                                        'client_id': strClientId
                                    }, objLogInfo, function callbackDelSys(pError, pResult) {
                                        try {
                                            if (pError) {
                                                reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52023', 'Error in _DeleteSystems function', error);
                                            } else if (pResult) {
                                                strResult.status = 'SUCCESS';
                                                k = k + 1;
                                            }
                                        } catch (error) {
                                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52024', 'Error in _DeleteSystems function', error);
                                        }
                                    });
                                }
                            }
                            if (k == strLength) {
                                _SelSystemToSystem();
                            }
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52025', 'Error in _DeleteSystems function', error);
                        }

                    }

                    // Do the system to system select for the parent system
                    function _SelSystemToSystem() {
                        try {
                            reqFXDBInstance.GetTableFromFXDB(mClient, ' system_to_system ', ['sts_id', 'cluster_code', 'parent_s_id', 'child_s_id'], {
                                'cluster_code': strClusterCode,
                                'parent_s_id': strSysId
                            }, objLogInfo, function callbackSelSTS(pError, pResult) {
                                try {
                                    if (pError) {
                                        reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52026', 'Error in _SelSystemToSystem function', error);
                                    } else if (pResult) {
                                        if (pResult.rows.length > 0) {
                                            arrSysId = [];
                                            return _SelSysToSys(strSysId);
                                        }
                                        if (pResult.rows.length == 0) {
                                            _DelAPPSTSROLES(strAppSTSId);
                                        }
                                    }
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52027', 'Error in _SelSystemToSystem function', error);
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52028', 'Error in _SelSystemToSystem function', error);
                        }
                    }

                    // Do the app system to system roles delete for the parent system
                    function _DelAPPSTSROLES(pAppStsId) {
                        try {
                            reqInstanceHelper.PrintInfo(serviceName, '_DelAPPSTSROLES called', objLogInfo);
                            reqFXDBInstance.DeleteFXDB(mClient, 'app_system_to_system_roles', {
                                'appsts_id': pAppStsId
                            }, objLogInfo, function callbackDelAppSTS(pErr, pResult) {
                                try {
                                    if (pErr) {
                                        reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52029', 'Error in _DelAPPSTSROLES function', error);
                                    } else if (pResult) {
                                        strResult.status = 'SUCCESS';
                                        _DeleteAPPSTS(pAppStsId);
                                    }
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52030', 'Error in _DelAPPSTSROLES function', error);
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52031', 'Error in _DelAPPSTSROLES function', error);
                        }
                    }

                    // Do the app system to system delete for the parent system
                    function _DeleteAPPSTS(pAppStsId) {
                        try {
                            reqInstanceHelper.PrintInfo(serviceName, '_DeleteAPPSTS called', objLogInfo);
                            reqFXDBInstance.DeleteFXDB(mClient, 'app_system_to_system', {
                                'appsts_id': pAppStsId
                            }, objLogInfo, function callbackDelAppSTS(pErr, pResult) {
                                if (pErr) {
                                    reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52032', 'Error in _DeleteAPPSTS function', error);
                                } else if (pResult) {
                                    strResult.status = 'SUC';
                                    if (strSystemDelete == 'Y') {
                                        _SelectSTS(strSysId);
                                    } else if (strSystemDelete == 'N' && strResult.status == 'SUC') {
                                        strResult.status = 'SUCCESS';
                                        _Response();
                                    }
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52033', 'Error in _DeleteAPPSTS function', error);
                        }
                    }

                    // Do the system to system select for the parent system
                    function _SelectSTS(pSId) {
                        try {
                            reqFXDBInstance.GetTableFromFXDB(mClient, 'system_to_system', ['sts_id', 'parent_s_id', 'child_s_id', 'cluster_code'], {
                                'cluster_code': strClusterCode
                            }, objLogInfo, function callbackSelSTS(pError, pResult) {
                                try {
                                    if (pError) {
                                        reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52034', 'Error in _SelectSTS function', error);
                                        // console.error(pError);
                                    } else if (pResult) {
                                        if (pResult.rows.length > 0) {
                                            var strSTSID = '';
                                            for (q = 0; q < pResult.rows.length; q++) {
                                                if (pResult.rows[q].child_s_id == pSId) {
                                                    strSTSID = pResult.rows[q].sts_id;
                                                }
                                            }
                                            strResult.status = 'SUCCESS';
                                            _DeleteSTS(strSTSID);
                                        } else {
                                            reqInstanceHelper.SendResponse(serviceName, appResposnse, 'There is No Record While Querying SYSTEM_TO_SYSTEM Table with Filter cluster_code - ' + strClusterCode, objLogInfo, '', '', '');
                                        }
                                    }
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52035', 'Error in _SelectSTS function', error);
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52036', 'Error in _SelectSTS function', error);
                        }
                    }

                    // Do the system to system delete for the parent system
                    function _DeleteSTS(pStsId) {
                        try {
                            reqInstanceHelper.PrintInfo(serviceName, '_DeleteSTS called', objLogInfo);
                            reqFXDBInstance.DeleteFXDB(mClient, 'system_to_system', {
                                'sts_id': pStsId
                            }, objLogInfo, function callbackDelSess(pError, pResult) {
                                try {
                                    if (pError) {
                                        reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52037', 'Error in _DeleteSTS function', pError);
                                        // console.error(pError);
                                    } else if (pResult) {
                                        strResult.status = 'SUCCESS';
                                        _SelSYS();
                                    }
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52038', 'Error in _DeleteSTS function', error);
                                }
                            });

                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52039', 'Error in _DeleteSTS function', error);
                        }
                    }

                    // Do the systems select for the parent system
                    function _SelSYS() {
                        try {
                            reqFXDBInstance.GetTableFromFXDB(mClient, 'systems', ['s_id', 'st_id'], {
                                's_id': strSysId
                            }, objLogInfo, function callbackSelSYS(pError, pResult) {
                                try {
                                    if (pError) {
                                        reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52040', 'Error in _SelSYS function', error);
                                        // console.error(pError);
                                    } else if (pResult) {
                                        var strSTID = '';
                                        if (pResult.rows.length > 0) {
                                            for (j = 0; j < pResult.rows.length; j++) {
                                                strSTID = pResult.rows[j].st_id;
                                            }
                                            strResult.status = 'SUCCESS';
                                            _DelSYS(strSTID);
                                        } else {
                                            reqInstanceHelper.SendResponse(serviceName, appResposnse, 'There is No Data Available While Querying SYSTEMS Table by S_ID - ' + strSysId, objLogInfo, '', '', '');
                                        }
                                    }
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52041', 'Error in _SelSYS function', error);
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52042', 'Error in _SelSYS function', error);
                        }
                    }
                    // Do the systems delete for the parent system
                    function _DelSYS(pStId) {
                        try {
                            reqFXDBInstance.DeleteFXDB(mClient, 'systems', {
                                'st_id': pStId,
                                's_id': strSysId,
                                'client_id': strClientId
                            }, objLogInfo, function callbackDelSys(pError, pResult) {
                                try {
                                    if (pError) {
                                        reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52043', 'Error in _DelSYS function', pError);
                                    } else if (pResult) {
                                        strResult.status = 'SUC';
                                        if (strResult.status == 'SUC') {
                                            strResult.status = 'SUCCESS'
                                            _Response()
                                        }
                                    }
                                } catch (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52044', 'Error in _DelSYS function', error);
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52045', 'Error in _DelSYS function', error);
                        }
                    }
                    function _Response() {
                        strResult.selectedCluster = strClusterCode;
                        strResult.SYS_SEARCH = '';
                        reqInstanceHelper.PrintInfo(serviceName, '_Response called', objLogInfo);
                        reqInstanceHelper.SendResponse(serviceName, appResposnse, strResult, objLogInfo);
                    }
                } catch (error) {
                    reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52001', 'Error in reqDBInstance.GetFXDBConnection callback', error);
                }
            });
        } catch (error) {
            reqInstanceHelper.SendResponse(serviceName, appResposnse, null, objLogInfo, 'ERR-MIN-52046', 'Error in reqLogInfo.AssignLogInfoDetail callback', error);
        }
    });
});

module.exports = router;
//*******End of Serive*******//