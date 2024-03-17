/*
@Api_Name        : /GetSharingWindowInfo,
@Description     : To Load Users and Roles against the login app and shared details,
@Last_Error_Code : ERR-HAN-40920
*/

// Require dependencies
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');
var reqExpress = require('express');
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLINQ = require("node-linq").LINQ;
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo')
var async = require('async');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance')

var router = reqExpress.Router();
var mClient;
var mdepClient;
var mTranDB;

var strServiceName = 'GetSharingWindowInfo'

// Query Preparation
var TRANALLOCACTION = 'SELECT * FROM TRANSACTION_ALLOCATION_ACTIONS ';
var TRANALLOC = 'SELECT * FROM TRANSACTION_ALLOCATIONS ';

// Host api to server
router.post('/GetSharingWindowInfo', function (appRequest, appResponse) {
    var objLogInfo = ''
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, session_info) {

            // Handle the close event when client close the connection 
            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });

            appResponse.setHeader('Content-Type', 'text/plain');
            objLogInfo = pLogInfo
            objLogInfo.HANDLER_CODE = 'SHARE_CONTENT';
            var Mode = '';
            var Level = ''
            var AL_Type = ''
            var AT_CODE = ''
            var APP_ID = ''
            var STS_ID = '';
            var client_id = ''
            var pCond = ''
            var TA_ID = '';
            var dtTranAllctnData = [];
            var bconnected = false;
            var dtClusters = {};
            var dv1 = {};
            var Result = '';
            var strMainRow = '';
            var arrAppUsers;
            var strInputParam = appRequest.body.PARAMS
            var strReqHeader = appRequest.headers
            _InitializeParams(strInputParam, session_info, function (presult) {
                Load_Allocation(function (result) {
                    var objResult = {}
                    objResult.AllocationData = result;
                    reqInsHelper.SendResponse(strServiceName, appResponse, JSON.stringify(objResult), objLogInfo, null, null);
                })
            })
            // Get Users, app_users and assign the already shared item details
            function Load_Allocation(callback) {
                try {
                    _InitializeDB(strReqHeader, function callbackInitializeDB(pStatus) {
                        try {
                            if (Mode == 'USER')
                                pCond = pCond + " and ALLOCATED_APPU_ID IS NOT NULL ";
                            else if (Mode == "ROLE")
                                pCond = pCond + " and ALLOCATED_APPR_ID IS NOT NULL ";
                            if (pCond != '')
                                var query = TRANALLOC + ' WHERE ' + pCond

                            reqTranDBInstance.ExecuteSQLQuery(mTranDB, query, objLogInfo, function (pRes, pErr) {
                                if (pErr) {
                                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40919', 'Error In Users Table Execution', pErr);
                                } else {
                                    try {
                                        dtTranAllctnData = pRes;
                                        if (dtTranAllctnData.rows.length > 0) {
                                            TA_ID = dtTranAllctnData.rows[0].ta_id;
                                        }
                                        // User mode
                                        if (Mode.toUpperCase() == 'USER') {
                                            var dtATMTActions = {};
                                            var strusercond = "APP_ID=" + APP_ID;
                                            var arrAttUser = [];

                                            if (Level.toUpperCase() == "FULL") {
                                                try {
                                                    //Users query
                                                    reqFXDBInstance.GetTableFromFXDB(mClient, 'users', ['login_name', 'first_name', 'u_id', 'email_id'], {
                                                        client_id: client_id
                                                    }, objLogInfo, function callbackUserquery(pErr, pResult) {
                                                        if (pErr) {
                                                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40901', 'Error In Users Table Execution', pErr);
                                                        } else {
                                                            try {
                                                                arrAppUsers = pResult.rows
                                                                reqFXDBInstance.GetTableFromFXDB(mClient, 'app_users', [], {
                                                                    APP_ID: APP_ID
                                                                }, objLogInfo, function callbackappquery(pErr, pResult) {
                                                                    if (pErr)
                                                                        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40902', 'Error In App_Users Table Execution', pErr);
                                                                    else {
                                                                        reqFXDBInstance.GetTableFromFXDB(mdepClient, 'ATTACHMENT_TYPES', [], {
                                                                            AT_CODE: AT_CODE
                                                                        }, objLogInfo, function (pErr, pResultCas) {
                                                                            if (pErr) {
                                                                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40903', 'Error In ATTACHMENT_TYPES Table Execution', pErr);
                                                                            } else {
                                                                                try {
                                                                                    var drrows = pResult.rows;
                                                                                    var arrUsers = [];
                                                                                    async.forEachOf(drrows, function (value, key, callback1) {
                                                                                        var objUser = {};
                                                                                        var drow = drrows[key];

                                                                                        var drresult = new reqLINQ(arrAppUsers)
                                                                                            .Where(function (row) {
                                                                                                return row.u_id == drow.u_id
                                                                                            })
                                                                                        drresult = drresult.items;
                                                                                        if (drresult.length > 0) {
                                                                                            objUser.LOGIN_NAME = drresult[0].login_name;
                                                                                            objUser.FIRST_NAME = drresult[0].first_name;
                                                                                            objUser.EMAIL_ID = drresult[0].email_id;
                                                                                            objUser.U_ID = drow.u_id;
                                                                                            objUser.APPU_ID = drow.appu_id;
                                                                                            objUser.APP_ID = drow.app_id;
                                                                                            _PrepareAttachmentActionUser(objUser, dtTranAllctnData.rows, drow.appu_id, AT_CODE, pResultCas, function callbackPrepareAtmtAction(pObject) {
                                                                                                arrAttUser.push(pObject);
                                                                                                callback1();
                                                                                            });
                                                                                        } else
                                                                                            callback1();
                                                                                    }, function (err) {
                                                                                        if (err)
                                                                                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40920', 'Error In Load_Allocation function', err);
                                                                                        else {
                                                                                            var strdtUser = JSON.stringify(arrAttUser);
                                                                                            var sortedObj = new reqLINQ(arrAttUser)
                                                                                                .OrderBy(function (item) {
                                                                                                    return item.LOGIN_NAME;
                                                                                                }).ToArray();
                                                                                            return callback(sortedObj);
                                                                                        }
                                                                                    });
                                                                                } catch (error) {
                                                                                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40924', 'Exception occured', error);
                                                                                }
                                                                            }
                                                                        });
                                                                    }
                                                                })
                                                            } catch (error) {
                                                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40923', 'Exception occured', error);
                                                            }
                                                        }
                                                    })
                                                } catch (error) {
                                                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40904', 'Error In Load_Allocation function', error);
                                                }
                                            } else {
                                                reqInsHelper.SendResponse(strServiceName, appResponse, 'FAILURE', objLogInfo, null, null);
                                            }
                                        } else if (Mode.toUpperCase() == 'ROLE') {
                                            // Role mode
                                            var arrAttRole = [];
                                            var dtATMTActions = {};
                                            var strrolecond = "APP_ID=" + APP_ID;

                                            if (Level.toUpperCase() == "FULL") {
                                                var objrows = [];
                                                try {
                                                    //Approle Query
                                                    reqFXDBInstance.GetTableFromFXDB(mClient, 'app_roles', [], {
                                                        APP_ID: APP_ID
                                                    }, objLogInfo, function callbackUserquery(pErr, pResult) {
                                                        if (pErr) {
                                                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40905', 'Error In app_roles Table Execution', pErr);
                                                        } else {
                                                            try {
                                                                reqFXDBInstance.GetTableFromFXDB(mdepClient, 'ATTACHMENT_TYPES', [], {
                                                                    AT_CODE: AT_CODE
                                                                }, objLogInfo, function (pErr, pResultCas) {
                                                                    if (pErr) {
                                                                        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40906', 'Error In ATTACHMENT_TYPES Table Execution', pErr);
                                                                    } else {
                                                                        try {
                                                                            var objrows = pResult.rows;
                                                                            var intAppRoleCount = objrows.length;
                                                                            var count = 0

                                                                            async.forEachOf(objrows, function (value, key, callback1) {
                                                                                var objRow = objrows[key];
                                                                                var objRoles = {};
                                                                                objRoles.ROLE_CODE = objRow.role_code;
                                                                                objRoles.ROLE_DESCRIPTION = objRow.role_description;

                                                                                objRoles.APPR_ID = objRow.appr_id;
                                                                                objRoles.APP_ID = objRow.app_id;

                                                                                _PrepareAttachmentActionRole(objRoles, dtTranAllctnData.rows, objRow.appr_id, AT_CODE, pResultCas, function callbackPrepareAtmtAction(pObject) {
                                                                                    arrAttRole.push(pObject);
                                                                                    count++
                                                                                    if (count == intAppRoleCount) {
                                                                                        var strdtRole = JSON.stringify(arrAttRole);
                                                                                        return callback(arrAttRole);
                                                                                    } else {
                                                                                        callback1();
                                                                                    }
                                                                                });

                                                                            }, function (err) {
                                                                                if (err) {
                                                                                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40920', 'Error In Load_Allocation function', err);
                                                                                } else {
                                                                                    callback(arrAttRole);
                                                                                }
                                                                            });
                                                                        } catch (error) {
                                                                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40907', 'Error In ATTACHMENT_TYPES Table Execution', error);
                                                                        }
                                                                    }
                                                                });
                                                            } catch (error) {
                                                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40907', 'Exception Occured', error);
                                                            }
                                                        }
                                                    })
                                                } catch (error) {
                                                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40908', 'Error In Level=="FULL"', error);
                                                }
                                            } else {
                                                reqInsHelper.SendResponse(strServiceName, appResponse, 'FAILURE', objLogInfo, null, null);
                                            }
                                        }
                                    } catch (error) {
                                        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40922', 'Exception Occured', error);
                                    }
                                }
                            })
                        } catch (error) {
                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40909', 'Error In Load_Allocation function', error);
                        }
                    })
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40910', 'Error in Load_Allocation function', error);
                }
            }

            // Get actions for the attachments for user mode
            function _PrepareAttachmentActionUser(objUser, dtTranAllctnData, appu_id, AT_CODE, pResultCas, pCallback) {
                try {
                    var intUserIds = new reqLINQ(dtTranAllctnData)
                        .Where(function (dr) {
                            return dr.allocated_appu_id != '' && dr.allocated_appu_id === appu_id;
                        }).ToArray();
                    if (intUserIds.length > 0) {
                        objUser.IS_CHECKED = true;
                        objUser.TA_ID = intUserIds[0].ta_id;
                        GetAttachmentActions(mTranDB, objUser, AT_CODE, intUserIds[0].ta_id, pResultCas, function (strTranAllocAction, pObjUser) {
                            pObjUser.TAA_CODE = JSON.stringify(strTranAllocAction)
                            pCallback(pObjUser)
                        });
                    } else {
                        objUser.IS_CHECKED = false;
                        objUser.TA_ID = "0"
                        GetAttachmentActions(mTranDB, objUser, AT_CODE, "0", pResultCas, function (strTranAllocAction, pObjUser) {
                            pObjUser.TAA_CODE = JSON.stringify(strTranAllocAction)
                            pCallback(pObjUser)
                        });
                    }
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40911', 'Error in PrepareAttachmentActionUser function', error);
                }
            }

            // Get actions for the attachments for Role mode
            function _PrepareAttachmentActionRole(objroles, dtTranAllctnData, appr_id, AT_CODE, pResultCas, pCallback) {
                try {
                    var intUserIds = new reqLINQ(dtTranAllctnData)
                        .Where(function (dr) {
                            return dr.allocated_appr_id !== '' && dr.allocated_appr_id === appr_id;
                        }).ToArray();
                    if (intUserIds.length > 0) {
                        objroles.IS_CHECKED = true;
                        objroles.TA_ID = intUserIds[0].ta_id;
                        GetAttachmentActions(mTranDB, objroles, AT_CODE, intUserIds[0].ta_id, pResultCas, function GetAttachmentActions(strTranAllocAction, pObjRoles) {
                            pObjRoles.TAA_CODE = JSON.stringify(strTranAllocAction)
                            pCallback(pObjRoles)
                        });
                    } else {
                        objroles.IS_CHECKED = false;
                        objroles.TA_ID = "0"
                        GetAttachmentActions(mTranDB, objroles, AT_CODE, "0", pResultCas, function (strTranAllocAction, pObjRoles) {
                            pObjRoles.TAA_CODE = JSON.stringify(strTranAllocAction)
                            pCallback(pObjRoles)
                        });
                    }
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40912', 'Error in PrepareAttachmentActionUser function', error);
                }
            }

            // Get the ations for the attachments 
            function GetAttachmentActions(objTRNDBSession, pUserRole, pAT_Code, TA_ID, pResult, callback) {
                try {
                    var objAtmtAction = {};
                    var Listofobj = {};
                    if (TA_ID == '') {
                        TA_ID = 0;
                    }
                    if (TA_ID == 0) {
                        var atactionarr = {
                            rows: []
                        }
                        _AssignActions(atactionarr, pResult, function CallbackAssignAction(arrAtmtAction) {
                            callback(arrAtmtAction, pUserRole)
                        })
                    } else {
                        var pCond = "ta_id = " + TA_ID;
                        var TRANALLOCACT = TRANALLOCACTION.toLowerCase() + '  where  ' + pCond
                        reqTranDBInstance.ExecuteSQLQuery(mTranDB, TRANALLOCACT, objLogInfo, function (pATTAction, pErr) {
                            if (pErr) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40913', 'Error in GetAttachmentActions function', pErr);
                            } else if (pATTAction) {
                                _AssignActions(pATTAction, pResult, function CallbackAssignAction(arrAtmtAction) {
                                    callback(arrAtmtAction, pUserRole)
                                })
                            }
                        })
                    }
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40914', 'Error in GetAttachmentActions function', error);
                }
            }

            function _AssignActions(pATTAction, pATActions, callback) {
                var arrAtmtAction = [];
                try {
                    if (pATActions.rows.length > 0) {
                        var Listofobj = pATActions.rows[0];
                        if (Listofobj['at_actions'] != undefined && Listofobj['at_actions'] != null && Listofobj['at_actions'] != '') {
                            var strActionjson = Listofobj['at_actions'].toString();
                            var ArrActionjson = JSON.parse(strActionjson);

                            for (i = 0; i < ArrActionjson.length; i++) {
                                var objAction = {}
                                var objAction = ArrActionjson[i];
                                objAction.ACTION_CODE = ArrActionjson[i].ACTION_CODE;
                                objAction.ACTION_DESCRIPTION = ArrActionjson[i].ACTION_DESCRIPTION;
                                var ActionRow = [];
                                if (pATTAction.rows.length > 0) {
                                    ActionRow = new reqLINQ(pATTAction.rows)
                                        .Where(function (row) {
                                            return row.action_code != '' && row.action_code == objAction.ACTION_CODE;
                                        }).ToArray();
                                    if (ActionRow.length > 0)
                                        objAction.IS_CHECKED = true;
                                    else
                                        objAction.IS_CHECKED = false;
                                } else
                                    objAction.IS_CHECKED = false;
                                arrAtmtAction.push(objAction);
                            }

                            callback(arrAtmtAction);
                        } else
                            callback(arrAtmtAction)
                    }
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40921', 'Error in TRANALLOCACT execution', error);
                }
            }

            // Get dep and clt connection
            function _InitializeDB(pHeaders, pCallback) {
                try {
                    reqFXDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(pClient) {
                        mdepClient = pClient
                        reqFXDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function CallbackGetCassandraConn(pClientClt) {
                            mClient = pClientClt
                            reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
                                mTranDB = pSession
                                pCallback('Success')
                            })
                        })
                    })
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40915', 'Error In _InitializeDB', error);
                }
            }

            // Initialize global variables
            function _InitializeParams(pClientParam, psession_info, callback) {
                try {
                    //Prepare Client Side Params
                    if (pClientParam['MODE'] != undefined && pClientParam['MODE'] != '')
                        Mode = pClientParam['MODE'].toString()

                    if (pClientParam['LEVEL'] != undefined && pClientParam['LEVEL'] != '')
                        Level = pClientParam['LEVEL'].toString()

                    if (pClientParam['TYPE'] != undefined && pClientParam['TYPE'] != '')
                        AL_Type = pClientParam['TYPE'].toString()

                    if (pClientParam['AT_CODE'] != undefined && pClientParam['AT_CODE'] != '')
                        AT_CODE = pClientParam['AT_CODE'].toString()

                    if (psession_info['APP_ID'] != undefined && psession_info['APP_ID'] != '')
                        APP_ID = psession_info['APP_ID'].toString()

                    if (psession_info['CLIENT_ID'] != undefined && psession_info['CLIENT_ID'] != '')
                        client_id = psession_info['CLIENT_ID'].toString()

                    if (pClientParam['COND'] != undefined && pClientParam['COND'] != '')
                        pCond = pClientParam['COND'].toString()
                    callback('SUCCESS')
                } catch (error) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40916', 'Error In _InitializeParams', error);
                }
            }
        })
    } catch (error) {
        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40917', 'Error In GetSharingWindowInfo', error);
    }

    // Print Log information
    function _PrintInfo(pMessage) {
        reqInsHelper.PrintInfo(strServiceName, pMessage, objLogInfo)
    }
});

module.exports = router;
/********** End of Service *********/