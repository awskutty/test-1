/*
@Api_Name           : /GetDpsSTS,
@Description        : Get the current login system and its child systems to bind for combo
@Last_Error_code    : ERR-HAN-41512
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
var serviceName = 'GetDpsSTS'
var mClient = '';
var pHeaders = '';

// Host api to server
router.post('/GetDpsSTS', function (appRequest, appResponse) {
    var objLogInfo = ''
    reqLogInfo.AssignLogInfoDetail(appRequest, function (LogInfo, objSessionInfo) {
        objLogInfo.HANDLER_CODE = 'BIND_SYSTEMS';
        // Handle the api close event when client close the request
        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });

        try {
            objLogInfo = LogInfo
            pHeaders = appRequest.headers;
            reqInstanceHelper.PrintInfo(serviceName, 'Begin', objLogInfo)
            reqFXDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pClient) {
                mClient = pClient;

                // var params = params;
                var params = Buffer.from(appRequest.body.PARAMS, 'base64').toString('ascii');
                params = JSON.parse(params);
                var arrFilter = params.FILTERS;
                var APPID = objSessionInfo.APP_ID;
                var UID = objSessionInfo.U_ID;
                var strFistrecord = params.FIRST_RECORD_DISPLAY
                var strDispmem = params.DISPLAY_MEMBER;
                var strValmem = params.DISPLAY_MEMBER;
                var strorderby = params.ORDER_BY;
                var SID = objSessionInfo.S_ID;
                var CLUSTER_CODE = objSessionInfo.CLUSTER_CODE;
                var arrResult = [];

                //Function call
                GetDpsSTS();

                // To query the system related tables with its link
                function GetDpsSTS() {
                    try {
                        reqInstanceHelper.PrintInfo(serviceName, 'Getting details from app_users table', objLogInfo)
                        reqFXDBInstance.GetTableFromFXDB(mClient, 'app_users', [], {
                            u_id: UID
                        }, objLogInfo, function callbackAPPUSERSEL(error, pResult) {
                            try {
                                if (error) {
                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41501', 'Error while getting details from app_users', error)
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
                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41502', 'Error while getting details from app_user_sts', error)
                                                    return
                                                } else {
                                                    var arrappstsid = new reqLINQ(pAppureslt.rows)
                                                        .Select(function (u) {
                                                            return u.appsts_id;
                                                        }).ToArray();
                                                    reqInstanceHelper.PrintInfo(serviceName, 'Getting details from app_system_to_system table', objLogInfo)
                                                    reqFXDBInstance.GetTableFromFXDB(mClient, 'app_system_to_system', [], {
                                                        appsts_id: arrappstsid,
                                                        app_id: APPID
                                                    }, objLogInfo, function callbackAPPSYSSEL(error, pAppsysreslt) {
                                                        try {
                                                            if (error) {
                                                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41503', 'Error while getting details from app_system_to_system', error)
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
                                                                    preparejson(pAppsysreslt);
                                                                } catch (error) {
                                                                    reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41504', 'Exception occured', error)
                                                                    return
                                                                }
                                                            }
                                                        } catch (error) {
                                                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41505', 'Exception occured', error)
                                                            return
                                                        }
                                                    })
                                                }
                                            } catch (error) {
                                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41506', 'Exception occured', error)
                                                return
                                            }
                                        })
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41507', 'Exception occured', error)
                                        return
                                    }
                                }
                            } catch (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41508', 'Exception occured', error)
                                return
                            }
                        })
                    } catch (error) {
                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41509', 'Exception occured', error)
                        return
                    }
                }

                // Prepare json object to return to client
                function preparejson(pAppsysreslt) {
                    try {
                        var strFirstItem = '';
                        var arr = [];
                        for (i = 0; i < pAppsysreslt.rows.length; i++) {
                            var obj = {};
                            obj.PARENT_S_ID = pAppsysreslt.rows[i].parent_s_id;
                            obj.CHILD_S_ID = pAppsysreslt.rows[i].child_s_id;
                            obj.S_DESCRIPTION = pAppsysreslt.rows[i].s_description;
                            obj.CLUSTER_CODE = pAppsysreslt.rows[i].cluster_code;
                            obj.S_ID = pAppsysreslt.rows[i].s_id;
                            obj.ST_ID = pAppsysreslt.rows[i].st_id;
                            obj.APPSTS_ID = pAppsysreslt.rows[i].appsts_id;
                            obj.S_CATEGORY = pAppsysreslt.rows[i].s_category;
                            obj.APP_ID = pAppsysreslt.rows[i].app_id;
                            obj.S_CODE = pAppsysreslt.rows[i].s_code;
                            arr.push(obj);
                        }
                        ApplyFilter(arr);
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, arrResult, objLogInfo, '', '', '')
                    } catch (error) {
                        return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41510', 'Exception occured', error)
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
                                        return u.S_ID == SID && u.CLUSTER_CODE == CLUSTER_CODE;
                                    }).ToArray();
                            }

                            // Form parent child systems
                            if (arrSys.length == 1) {
                                for (var sys in arrSys) {
                                    AppendRowToResult(arrSys[sys])
                                    // Call Recursive systems and append to array
                                    AddChildSystems(arrSTS);
                                }
                            } else {
                                //for (var sys in arrSTS) 
                                for (var sys in arrSTS) {
                                    AppendRowToResult(arrSTS[sys])
                                }
                            }
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41511', 'Exception occured', error)
                            return
                        }
                    }

                    function AddChildSystems(arrSTS) {
                        var arrTempSys = new reqLINQ(arrSTS)
                            .Where(function (u) {
                                return u.CLUSTER_CODE == CLUSTER_CODE;
                            }).ToArray();
                        for (var sys in arrTempSys) {
                            if (arrTempSys[sys].PARENT_S_ID == SID) {
                                AppendRowToResult(arrTempSys[sys]);
                            }
                        }
                    }

                    // Form the system row and add it to array result
                    function AppendRowToResult(sys) {
                        var objRow = {};
                        objRow.PARENT_S_ID = sys.PARENT_S_ID;
                        objRow.CHILD_S_ID = sys.CHILD_S_ID;
                        objRow.S_DESCRIPTION = sys.S_DESCRIPTION;
                        objRow.CLUSTER_CODE = sys.CLUSTER_CODE;
                        objRow.S_ID = sys.S_ID;
                        objRow.ST_ID = sys.ST_ID;
                        objRow.APPSTS_ID = sys.APPSTS_ID;
                        objRow.S_CATEGORY = sys.S_CATEGORY;
                        objRow.APP_ID = sys.app_id;
                        objRow.S_CODE = sys.s_code;
                        arrResult.push(objRow);
                    }
                }
            })
        } catch (error) {
            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41512', 'Exception occured', error)
            return
        }
    });
});

module.exports = router;
/*********** End of Service **********/