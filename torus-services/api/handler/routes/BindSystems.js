/*
@Api_Name           : /BindSystems,
@Description        : Get the current login system and its parent - child systems to bind for combo
@Last_Error_code    : ERR-HAN-41518
*/

// Require dependencies
var reqExpress = require('express');
var router = reqExpress.Router();
var reqLINQ = require("node-linq").LINQ;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');

// Global variable initialization
var serviceName = 'BindSystems';

// Host api to server
router.post('/BindSystems', function (appRequest, appResponse) {
    var mClient = '';
    var pHeaders = '';
    var objLogInfo = '';
    reqLogInfo.AssignLogInfoDetail(appRequest, function (LogInfo, objSessionInfo) {
        objLogInfo.HANDLER_CODE = 'BIND_SYSTEMS';
        // Handle the api close event when client close the request
        appResponse.on('close', function () { });
        appResponse.on('finish', function () { });
        appResponse.on('end', function () { });
        try {
            objLogInfo = LogInfo;
            pHeaders = appRequest.headers;
            _PrintInfo(objLogInfo, 'BindSystems Begin');
            reqFXDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pClient) {
                try {
                    mClient = pClient;
                    // var params = appRequest.body.PARAMS;
                    var params = Buffer.from(appRequest.body.PARAMS, 'base64').toString('ascii');
                    params = JSON.parse(params);
                    // var SID = params.systemID;
                    var SID = objSessionInfo.S_ID;
                    var APPID = objSessionInfo.APP_ID;
                    var UID = objSessionInfo.U_ID;
                    var APPU_ID = objSessionInfo.APPU_ID;
                    var CLUSTER_CODE = objSessionInfo.CLUSTER_CODE;
                    var arrAllRows = [];
                    var booleanCurrSystem = params.CURRENT_SYS;
                    var strChildSystem = params.CHILDSYS || 'None';
                    var strParentSystem = params.PARENTSYS || 'None';
                    var strFIRST_RECORD_DISPLAY = params.FIRST_RECORD_DISPLAY;
                    var strDISPLAY_MEMBER = params.DISPLAY_MEMBER;
                    var strVALUE_MEMBER = params.VALUE_MEMBER;
                    var strorderby = params.ORDER_BY || "S_DESCRIPTION";
                    var strFILTERS = params.FILTERS;
                    if (strFILTERS) {
                        strFILTERS = JSON.parse(strFILTERS);
                    }
                    var strVM = '';
                    var finalResult = [];

                    _PrintInfo(objLogInfo, 'Input Params are Current System - ' + booleanCurrSystem + ', Parent System - ' + strParentSystem.toUpperCase() + ', Child System - ' + strChildSystem.toUpperCase());
                    _PrintInfo(objLogInfo, 'Getting details from app_user_sts table');
                    reqFXDBInstance.GetTableFromFXDB(mClient, 'app_user_sts', [], {
                        appu_id: APPU_ID
                    }, objLogInfo, function callbackAPPUSERSTSSEL(error, pAppureslt) {
                        try {
                            if (error) {
                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41502', 'Error while getting details from app_user_sts', error);
                            } else {
                                var arrappstsid = new reqLINQ(pAppureslt.rows)
                                    .Select(function (u) {
                                        return u.appsts_id;
                                    }).ToArray();
                                var filterCondition = {
                                    app_id: APPID,
                                    appsts_id: arrappstsid
                                };

                                _PrintInfo(objLogInfo, 'Getting details from app_system_to_system table');
                                reqFXDBInstance.GetTableFromFXDB(mClient, 'app_system_to_system', [], filterCondition, objLogInfo, function callbackAPPSYSSEL(error, pAppsysreslt) {
                                    try {
                                        if (error) {
                                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41503', 'Error while getting details from app_system_to_system', error);
                                        } else {
                                            try {
                                                var parent = [];
                                                var child = [];
                                                var currentSystem = [];
                                                (pAppsysreslt.rows).forEach(function (e) {
                                                    e.isAllChildProcessed = false;
                                                    e.isImmediateParentProcessed = false;
                                                });
                                                if (strParentSystem.toUpperCase() == 'ALL' || strChildSystem.toUpperCase() == 'ALL' || strParentSystem.toUpperCase() == 'UNALLOCATED' || strChildSystem.toUpperCase() == 'UNALLOCATED') {
                                                    var filterCondition = {
                                                        app_id: APPID,
                                                        cluster_code: CLUSTER_CODE
                                                    };
                                                    _PrintInfo(objLogInfo, 'Getting details from app_system_to_system table filter by cluster code');
                                                    reqFXDBInstance.GetTableFromFXDB(mClient, 'app_system_to_system', [], filterCondition, objLogInfo, function callbackAPPSYSSEL(error, pUnallocatedResult) {
                                                        try {
                                                            if (error) {
                                                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41503', 'Error while getting details from app_system_to_system', error);
                                                            } else {
                                                                (pUnallocatedResult.rows).forEach(function (e) {
                                                                    e.isUnAllocatedParentProcessed = false;
                                                                    e.isUnAllocatedChildProcessed = false;
                                                                });
                                                                arrAllRows = pUnallocatedResult.rows;
                                                                processingSystemIDs();
                                                            }
                                                        }
                                                        catch (error) {
                                                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41504', 'Exception occured', error);
                                                        }
                                                    });
                                                } else {
                                                    processingSystemIDs();
                                                }
                                                function processingSystemIDs() {
                                                    _PrintInfo(objLogInfo, 'processingSystemIDs() Begin');
                                                    getRecursiveParentId(SID, pAppsysreslt.rows);
                                                    function getRecursiveParentId(s_id, arrAllIDs) {
                                                        try {
                                                            // To get unassigned systems from the selected system
                                                            if (strParentSystem.toUpperCase() == 'UNALLOCATED') {
                                                                new reqLINQ(arrAllRows)
                                                                    .Select(function (row) {
                                                                        if (s_id != row.child_s_id) {
                                                                            getParentSystemIDs(row.parent_s_id, arrAllIDs, arrAllRows, 'UNALLOCATED');
                                                                        } else {
                                                                            // To get currently selected system
                                                                            if (booleanCurrSystem) {
                                                                                addCurrentSystem(row);
                                                                            }
                                                                        }

                                                                    });
                                                            }
                                                            else {
                                                                new reqLINQ(arrAllIDs)
                                                                    .Select(function (row) {
                                                                        if (s_id == row.child_s_id) {
                                                                            if (booleanCurrSystem) {
                                                                                addCurrentSystem(row);
                                                                            }
                                                                        }
                                                                        switch (strParentSystem.toUpperCase()) {
                                                                            case 'ALL': // To get both assigned and unassigned systems from selected system 
                                                                                if (s_id == row.child_s_id) {
                                                                                    getParentSystemIDs(row.parent_s_id, arrAllRows, [], 'ALL');
                                                                                }
                                                                                break;
                                                                            case 'ALLOCATED': // To get assigned systems from the currently selected system
                                                                                if (s_id == row.child_s_id) {
                                                                                    getParentSystemIDs(row.parent_s_id, arrAllIDs, [], 'ALLOCATED');
                                                                                }
                                                                                break;
                                                                            case 'IMMEDIATE': // To get next level Parent System from the currently selected system
                                                                                if (s_id == row.child_s_id) {
                                                                                    if (row.parent_s_id == 0) {
                                                                                        // parent.push(row);
                                                                                    } else {
                                                                                        for (var i = 0; i < arrAllIDs.length; i++) {
                                                                                            if (row.parent_s_id == arrAllIDs[i].s_id && !arrAllIDs[i].isImmediateParentProcessed) {
                                                                                                parent.push(arrAllIDs[i]);
                                                                                                arrAllIDs[i].isImmediateParentProcessed = true;
                                                                                            }
                                                                                        }
                                                                                    }
                                                                                }
                                                                                break;
                                                                            case 'ROOT'://  To get root level system id 
                                                                                if (row.parent_s_id == '0') {
                                                                                    parent.push(row);
                                                                                }
                                                                            case 'NONE':
                                                                                break;
                                                                            default:
                                                                                break;
                                                                        }
                                                                    });
                                                            }
                                                        } catch (error) {
                                                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41514', 'Error in getRecursiveParentId()', error);
                                                        }
                                                    }
                                                    function addCurrentSystem(row) {
                                                        currentSystem.push(row);
                                                    }
                                                    getRecursiveChildId(SID, arrAllRows);
                                                    function getRecursiveChildId(s_id, arrAllIDs) {
                                                        try {
                                                            if (strChildSystem.toUpperCase() == 'UNALLOCATED') {
                                                                new reqLINQ(arrAllRows)
                                                                    .Select(function (row) {
                                                                        if (s_id == row.parent_s_id) {
                                                                            getChildSystemIDs(row.parent_s_id, arrAllIDs, arrAllRows, 'UNALLOCATED');
                                                                        }
                                                                    });
                                                            }
                                                            else {
                                                                new reqLINQ(arrAllIDs)
                                                                    .Select(function (row) {
                                                                        switch (strChildSystem.toUpperCase()) {
                                                                            case 'ALL':
                                                                                if (s_id == row.parent_s_id) {
                                                                                    getChildSystemIDs(s_id, arrAllRows, [], 'ALL');
                                                                                }
                                                                                break;
                                                                            case 'ALLOCATED':
                                                                                if (s_id == row.parent_s_id) {
                                                                                    getChildSystemIDs(s_id, arrAllIDs, [], 'ALLOCATED');
                                                                                }
                                                                                break;
                                                                            case 'IMMEDIATE':
                                                                                if (s_id == row.parent_s_id) {
                                                                                    child.push(row);
                                                                                }
                                                                                break;
                                                                            case 'NONE':
                                                                                break;
                                                                            default:
                                                                                break;
                                                                        }
                                                                    });
                                                            }
                                                        } catch (error) {
                                                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41515', 'Error in getRecursiveChildId()', error);
                                                        }
                                                    }
                                                    _PrintInfo(objLogInfo, 'Preparing JSON');
                                                    preparejson(parent, 'parentSystem', false, function () {
                                                        preparejson(child, 'childSystem', false, function () {
                                                            preparejson(currentSystem, 'currentSystem', true);
                                                        });
                                                    });
                                                }

                                                function getParentSystemIDs(p_id, pAllocatedRows, pAllRows, pCase) { // p_id - parent_s_id and s_id and child_id will be equal by default
                                                    try {
                                                        if (pCase == 'UNALLOCATED') { // To filter the records from pAllRows [query result with filter by Cluster Code] which is not exist in pAllocatedRows
                                                            for (var i = 0; i < pAllRows.length; i++) {
                                                                if (p_id == pAllRows[i].s_id) {
                                                                    var isTrue = false;
                                                                    for (var j = 0; j < pAllocatedRows.length; j++) {
                                                                        if (pAllRows[i].s_id == pAllocatedRows[j].s_id) {
                                                                            isTrue = true;
                                                                            break;
                                                                        }
                                                                        if (j == pAllocatedRows.length - 1 && !isTrue && !pAllRows[i].isUnAllocatedParentProcessed) {
                                                                            parent.push(pAllRows[i]);
                                                                            pAllRows[i].isUnAllocatedParentProcessed = true;
                                                                        }
                                                                    }
                                                                    break;
                                                                }
                                                            }
                                                        }
                                                        else { // To get all the systems by comparing the p_id with pAllocatedRows of all s_id, if p_id and s_id are equal then push the record and recursively calling the function to find all systems
                                                            for (var i = 0; i < pAllocatedRows.length; i++) {
                                                                if (p_id == pAllocatedRows[i].s_id) {
                                                                    parent.push(pAllocatedRows[i]);
                                                                    getParentSystemIDs(pAllocatedRows[i].parent_s_id, pAllocatedRows, pAllRows, pCase);
                                                                    break;
                                                                }
                                                            }
                                                        }
                                                    } catch (error) {
                                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41513', 'Error in getParentSystemIDs()', error);
                                                    }
                                                }

                                                function getChildSystemIDs(c_id, pAllocatedRows, pAllRows, pCase) {
                                                    try {
                                                        if (pCase == 'UNALLOCATED') {
                                                            for (var i = 0; i < pAllRows.length; i++) {
                                                                if (c_id == pAllRows[i].parent_s_id) {
                                                                    var isTrue = false;
                                                                    for (var j = 0; j < pAllocatedRows.length; j++) {
                                                                        if (pAllRows[i].s_id == pAllocatedRows[j].s_id) {
                                                                            isTrue = true;
                                                                        }
                                                                        if (j == pAllocatedRows.length - 1 && !isTrue && !pAllRows[i].isUnAllocatedChildProcessed) {
                                                                            child.push(pAllRows[i]);
                                                                            pAllRows[i].isUnAllocatedChildProcessed = true;
                                                                        }
                                                                    }
                                                                    getChildSystemIDs(pAllRows[i].s_id, pAllocatedRows, pAllRows, pCase);
                                                                }
                                                            }
                                                        }
                                                        else {
                                                            for (var i = 0; i < pAllocatedRows.length; i++) {
                                                                if (c_id == pAllocatedRows[i].parent_s_id && !pAllocatedRows[i].isAllChildProcessed) {
                                                                    child.push(pAllocatedRows[i]);
                                                                    pAllocatedRows[i].isAllChildProcessed = true;
                                                                    getChildSystemIDs(pAllocatedRows[i].s_id, pAllocatedRows, pAllRows, pCase);
                                                                    // break;
                                                                }
                                                            }
                                                        }
                                                    } catch (error) {
                                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41516', 'Error in getChildSystemIDs()', error);
                                                    }
                                                }
                                            } catch (error) {
                                                reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41517', 'Exception occured', error);
                                                return;
                                            }
                                        }
                                    } catch (error) {
                                        reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41505', 'Exception occured', error);
                                        return;
                                    }
                                });
                            }
                        } catch (error) {
                            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41506', 'Exception occured', error);
                            return;
                        }
                    });
                    /* var arrChildResult = [];
                    var arrParentResult = [];
                    var arrCurrentSystemResult = []; */

                    // Prepare json object to return to client
                    function preparejson(pAppsysreslt, pSystem, isSendResp, pPreparejson) {
                        try {
                            _PrintInfo(objLogInfo, pSystem + ' - Returned ' + pAppsysreslt.length + ' Rows');
                            for (i = 0; i < pAppsysreslt.length; i++) {
                                var obj = {};
                                obj.PARENT_S_ID = pAppsysreslt[i].parent_s_id;
                                obj.CHILD_S_ID = pAppsysreslt[i].child_s_id;
                                obj.S_DESCRIPTION = pAppsysreslt[i].s_description;
                                obj.CLUSTER_CODE = pAppsysreslt[i].cluster_code;
                                obj.S_ID = pAppsysreslt[i].s_id;
                                obj.ST_ID = pAppsysreslt[i].st_id;
                                obj.APPSTS_ID = pAppsysreslt[i].appsts_id;
                                obj.S_CATEGORY = pAppsysreslt[i].s_category;
                                obj.APP_ID = pAppsysreslt[i].app_id;
                                obj.S_CODE = pAppsysreslt[i].s_code;
                                obj.ST_CODE = pAppsysreslt[i].st_code;
                                // Check system already available in array
                                var rootsys = finalResult.filter(function (e) {
                                    return e.PARENT_S_ID == obj.PARENT_S_ID && e.CHILD_S_ID == obj.CHILD_S_ID;
                                });

                                if (rootsys.length) {
                                    continue;
                                } else {
                                    finalResult.push(obj);
                                }

                                /* if (pSystem == 'childSystem') {
                                    arrChildResult.push(obj);
                                } else if (pSystem == 'parentSystem') {
                                    arrParentResult.push(obj);
                                } else {
                                    arrCurrentSystemResult.push(obj);
                                } */
                            }
                            if (isSendResp) {
                                _PrintInfo(objLogInfo, 'JSON Prepared');
                                _PrintInfo(objLogInfo, 'processingSystemIDs() End');
                                /* finalResult.push({ ParentLength: arrParentResult.length, ParentData: arrParentResult },
                                     { ChildLength: arrChildResult.length, ChildData: arrChildResult },
                                     { CurrentSystemLength: arrCurrentSystemResult.length, CurrentSystemdData: arrCurrentSystemResult }); */

                                // Order by result  
                                if (strorderby != '' && strorderby != null) {
                                    var orderbyRes = new reqLINQ(finalResult)
                                        .OrderBy(function (u) {
                                            return u[strorderby];
                                        }).ToArray();

                                    finalResult = orderbyRes;
                                }


                                if (strFILTERS.length) {

                                    for (var i = 0; i < strFILTERS.length; i++) {
                                        if (strFILTERS[i].OPRTR == '=') {
                                            var filterRes = new reqLINQ(finalResult)
                                                .Where(function (u) {
                                                    return u[strFILTERS[i].BINDING_NAME] == strFILTERS[i].BINDING_VALUE;
                                                }).ToArray();
                                        }

                                        if (strFILTERS[i].OPRTR == '<') {
                                            var filterRes = new reqLINQ(finalResult)
                                                .Where(function (u) {
                                                    return u[strFILTERS[i].BINDING_NAME] < strFILTERS[i].BINDING_VALUE;
                                                }).ToArray();
                                        }

                                        if (strFILTERS[i].OPRTR == '<=') {
                                            var filterRes = new reqLINQ(finalResult)
                                                .Where(function (u) {
                                                    return u[strFILTERS[i].BINDING_NAME] <= strFILTERS[i].BINDING_VALUE;
                                                }).ToArray();
                                        }

                                        if (strFILTERS[i].OPRTR == '>') {
                                            var filterRes = new reqLINQ(finalResult)
                                                .Where(function (u) {
                                                    return u[strFILTERS[i].BINDING_NAME] > strFILTERS[i].BINDING_VALUE;
                                                }).ToArray();
                                        }
                                        if (strFILTERS[i].OPRTR == '=>') {
                                            var filterRes = new reqLINQ(finalResult)
                                                .Where(function (u) {
                                                    return u[strFILTERS[i].BINDING_NAME] >= strFILTERS[i].BINDING_VALUE;
                                                }).ToArray();
                                        }
                                        if (strFILTERS[i].OPRTR == '<>') {
                                            var filterRes = new reqLINQ(finalResult)
                                                .Where(function (u) {
                                                    return u[strFILTERS[i].BINDING_NAME] != strFILTERS[i].BINDING_VALUE;
                                                }).ToArray();
                                        }
                                        if (strFILTERS[i].OPRTR == 'IN' || strFILTERS[i].OPRTR == 'CONTAINS') {
                                            var filterRes = new reqLINQ(finalResult)
                                                .Where(function (u) {
                                                    return strFILTERS[i].BINDING_VALUE.split(',').includes(u[strFILTERS[i].BINDING_NAME]);
                                                }).ToArray();
                                        }
                                    }
                                    _PrintInfo(objLogInfo, 'Response Count After Filtering with OPERATOR - ' + filterRes.length);
                                    finalResult = filterRes;
                                }

                                var strMember = {};
                                if (strFIRST_RECORD_DISPLAY != '') {
                                    if (strDISPLAY_MEMBER == strVALUE_MEMBER) {
                                        strVM = strDISPLAY_MEMBER + '_1';
                                        strMember[strDISPLAY_MEMBER] = strFIRST_RECORD_DISPLAY;
                                        strMember[strVM] = 'null';
                                    } else {
                                        strMember[strDISPLAY_MEMBER] = strFIRST_RECORD_DISPLAY;
                                        strMember[strVALUE_MEMBER] = 'null';
                                    }
                                    finalResult.unshift(strMember);
                                }



                                reqInstanceHelper.SendResponse(serviceName, appResponse, finalResult, objLogInfo, '', '', '');
                                return arrParentResult = arrChildResult = finalResult = [];
                            }
                            else {
                                pPreparejson();
                            }
                        } catch (error) {
                            return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41518', 'Exception occured', error);
                        }
                    }
                } catch (error) {
                    return reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41510', 'Error in GetFXDBConnection()', error);
                }
            });
        } catch (error) {
            reqInstanceHelper.SendResponse(serviceName, appResponse, null, objLogInfo, 'ERR-HAN-41512', 'Exception occured', error);
        }

        function _PrintInfo(pLogInfo, pMessage) {
            reqInstanceHelper.PrintInfo(serviceName, pMessage, pLogInfo);
        }

        function _PrintError(pLogInfo, pErrCode, pMessage, pError) {
            reqInstanceHelper.PrintError(serviceName, pError, pErrCode, pLogInfo, pMessage);
        }
    });
});

module.exports = router;
/*********** End of Service **********/