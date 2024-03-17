/*
@Api_Name           : /GetDPSDSTSTS,
@Description        : Get the current login system and its child systems to bind for combo
@Last_Error_code    : ERR-HAN-43612
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqDBInstance = require('../../../../torus-references/instance/CassandraInstance');
var reqLINQ = require("node-linq").LINQ;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance')
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper')


// Global variable initialization
var serviceName = 'GetDpsDstSTS'
var mClient = '';
var pHeaders = '';

// Host api to server
router.post('/GetDpsDstSTS', function (appRequest, appResponse) {
    var objLogInfo = ''
    reqLogInfo.AssignLogInfoDetail(appRequest, function (LogInfo, objSessionInfo) {
        objLogInfo.HANDLER_CODE = 'BIND_SYSTEMS';
        // Handle the api close event when client close the request
        appResponse.on('close', function () {});
        appResponse.on('finish', function () {});
        appResponse.on('end', function () {});

        try {
            objLogInfo = LogInfo
            pHeaders = appRequest.headers;
            reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)
            reqFXDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pClient) {
                mClient = pClient;

                var params = appRequest.body.PARAMS;
                var arrFilter = appRequest.body.PARAMS.FILTERS;
                var APPID = objSessionInfo.APP_ID;
                var UID = objSessionInfo.U_ID;
                var strFistrecord = appRequest.body.PARAMS.FIRST_RECORD_DISPLAY
                var strDispmem = appRequest.body.PARAMS.DISPLAY_MEMBER;
                var strValmem = appRequest.body.PARAMS.DISPLAY_MEMBER;
                var strorderby = appRequest.body.PARAMS.ORDER_BY;
                var AppStsID = objSessionInfo.APPSTS_ID;
                var CLUSTER_CODE = objSessionInfo.CLUSTER_CODE;
                var strDestSysWithParent = (appRequest.body.PARAMS.CBOTYPE != undefined && appRequest.body.PARAMS.CBOTYPE != null && appRequest.body.PARAMS.CBOTYPE != '') ? appRequest.body.PARAMS.CBOTYPE : ''
                var arrResult = [];

                //Function call
                GetDpsSTS();

                // To query the system related tables with its link
                function GetDpsSTS() {
                    try {
                        reqInstanceHelper.PrintInfo(serviceName, 'Getting details from app_users table', objLogInfo)
                        reqFXDBInstance.GetTableFromFXDB(mClient, 'app_users', [], {
                            U_ID: UID,
                            APP_ID: APPID
                        }, objLogInfo, function callbackAPPUSERSEL(error, pResult) {
                            try {
                                if (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-43601', 'Error while getting details from app_users', error)
                                    return
                                } else {
                                    try {
                                        var arrappuid = new reqLINQ(pResult.rows)
                                            .Select(function (u) {
                                                return u.appu_id;
                                            }).ToArray();
                                        reqInstanceHelper.PrintInfo(serviceName, 'Getting details from app_user_sts table', objLogInfo)
                                        reqFXDBInstance.GetTableFromFXDB(mClient, 'app_user_sts', [], {
                                            appu_id: arrappuid
                                        }, objLogInfo, function callbackAPPUSERSTSSEL(error, pAppureslt) {
                                            try {
                                                if (error) {
                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-43602', 'Error while getting details from app_user_sts', error)
                                                    return
                                                } else {
                                                    var arrappstsid = new reqLINQ(pAppureslt.rows)
                                                        .Select(function (u) {
                                                            return u.appsts_id === AppStsID;
                                                        }).ToArray();
                                                    if (arrappstsid.length > 0) {
                                                        reqInstanceHelper.PrintInfo(serviceName, 'Getting details from app_system_to_system table', objLogInfo)
                                                        reqFXDBInstance.GetTableFromFXDB(mClient, 'app_system_to_system', [], {
                                                            CLUSTER_CODE: CLUSTER_CODE,
                                                            APP_ID: APPID
                                                        }, objLogInfo, function callbackAPPSYSSEL(error, pAppsysreslt) {
                                                            try {
                                                                if (error) {
                                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-43603', 'Error while getting details from app_system_to_system', error)
                                                                    return
                                                                } else {
                                                                    try {
                                                                        //Order by param value
                                                                        if (strorderby != '' && strorderby != null) {
                                                                            var arrAppsysresl = new reqLINQ(pAppsysreslt.rows)
                                                                                .OrderBy(function (u) {
                                                                                    return u[strorderby];
                                                                                }).ToArray();
                                                                        }
                                                                        reqInstanceHelper.PrintInfo(serviceName, 'Preparing JSON', objLogInfo)
                                                                        ApplyFilter(pAppsysreslt.rows)
                                                                        return reqInstanceHelper.SendResponse(serviceName, appResponse, arrResult, objLogInfo, '', '', '')
                                                                    } catch (error) {
                                                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-43604', 'Exception occured', error)
                                                                        return
                                                                    }
                                                                }
                                                            } catch (error) {
                                                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-43605', 'Exception occured', error)
                                                                return
                                                            }
                                                        })
                                                    } else {
                                                        // Currently selected APPSTSID is not allocated to current app user
                                                        reqInstanceHelper.SendResponse(serviceName, appResponse, [], objLogInfo, 'ERR-HAN-43606', 'Exception occured', error)
                                                        return
                                                    }
                                                }
                                            } catch (error) {
                                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-43607', 'Exception occured', error)
                                                return
                                            }
                                        })
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-43608', 'Exception occured', error)
                                        return
                                    }
                                }
                            } catch (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-43609', 'Exception occured', error)
                                return
                            }
                        })
                    } catch (error) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-43610', 'Exception occured', error)
                        return
                    }
                }

                // Recursive function get login system and its child systems
                function ApplyFilter(arrSTS) {
                    try {
                        // Add first record
                        if (strFistrecord != null && strFistrecord != '') {
                            var objRow = {};
                            objRow.S_DESCRIPTION = strFistrecord;
                            objRow.S_ID = "";
                            arrResult.push(objRow);
                        }
                        var arrSys = [];
                        if (arrSTS.length > 0) {
                            arrSys = new reqLINQ(arrSTS)
                                .Where(function (u) {
                                    return u.appsts_id == AppStsID && u.cluster_code == CLUSTER_CODE;
                                }).ToArray();
                        }

                        // Form parent child systems
                        if (arrSys.length == 1) {
                            if (arrSTS.length == 1) {
                                for (var sys in arrSTS) {
                                    AppendRowToResult(arrSTS[sys])
                                }
                            } else {
                                for (var sys in arrSys) {

                                    if (strDestSysWithParent == 'DPS_DST_STS_PARENT')
                                        AppendRowToResult(arrSys[sys]) // no need to show currently selected system
                                    // Call Recursive systems and append to array
                                    AddChildSystems(arrSTS, arrSys[sys].child_s_id);
                                }
                            }
                        } else {
                            //for (var sys in arrSTS) 
                            for (var sys in arrSTS) {
                                AppendRowToResult(arrSTS[sys])
                            }
                        }
                    } catch (error) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-43611', 'Exception occured', error)
                        return
                    }
                }

                function AddChildSystems(arrSTS, pParentSID) {
                    var arrTempSys = new reqLINQ(arrSTS)
                        .Where(function (u) {
                            return u.parent_s_id == pParentSID && u.cluster_code == CLUSTER_CODE;
                        }).ToArray();
                    for (var sys in arrTempSys) {
                        AppendRowToResult(arrTempSys[sys]);
                        AddChildSystems(arrSTS, arrTempSys[sys].child_s_id);
                    }
                }

                // Form the system row and add it to array result
                function AppendRowToResult(sys) {
                    var objRow = {};
                    objRow.PARENT_S_ID = sys.parent_s_id;
                    objRow.CHILD_S_ID = sys.child_s_id;
                    objRow.S_DESCRIPTION = sys.s_description;
                    objRow.CLUSTER_CODE = sys.cluster_code;
                    objRow.S_ID = sys.s_id;
                    objRow.ST_ID = sys.st_id;
                    objRow.APPSTS_ID = sys.appsts_id;
                    objRow.S_CATEGORY = sys.s_category;
                    objRow.APP_ID = sys.app_id;
                    objRow.S_CODE = sys.s_code;
                    arrResult.push(objRow);
                }

            })
        } catch (error) {
            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-43612', 'Exception occured', error)
            return
        }
    });
});

module.exports = router;
/*********** End of Service **********/