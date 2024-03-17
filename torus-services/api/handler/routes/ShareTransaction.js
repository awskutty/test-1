/*
@Api_Name        : /ShareTransaction,
@Description     : To Share the transcations for specific Users and roles,
@Last_Error_Code : ERR-HAN-41021
*/

// Require dependencies
var reqExpress = require('express');
var reqHashTable = require('jshashtable');
var async = require('async');
var router = reqExpress.Router();
var reqLINQ = require('node-linq').LINQ;
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqSrvHlpr = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');
var q = require('q');
var co = require("co");
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');

// Global variable initialization 
var mClient = '';
var mTranDB = '';

var TRANALLOCACTION = 'SELECT * FROM TRANSACTION_ALLOCATION_ACTIONS ';
var TRANALLOC = 'SELECT * FROM TRANSACTION_ALLOCATIONS ';
var pHeaders = '';
var strServiceName = 'ShareTransaction';



// Host api to server
router.post('/ShareTransaction', function (appRequest, appResponse) {
    var objLogInfo = '';
    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function (pLogInfo, session_info) {
            pHeaders = appRequest.headers;
            objLogInfo = pLogInfo;
            appResponse.setHeader('Content-Type', 'text/plain');

            // Handle the close event when client close the connection 
            appResponse.on('close', function () { });
            appResponse.on('finish', function () { });
            appResponse.on('end', function () { });

            objLogInfo.HANDLER_CODE = 'SHARE_CONTENT';
            _PrintInfo('Begin');
            reqFXDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(pClient_clt) {
                mClient = pClient_clt;
                reqTranDBInstance.GetTranDBConn(pHeaders, false, function (pSession) {
                    mTranDB = pSession;
                    var response = appResponse;
                    var htTrnAllocatn = {};
                    var htInsertTrnAllocatn = [];
                    var htUpdateTrnAllocatn = '';
                    var htDeleteTrnAllocatn = '';
                    var htTmpTranAllocatn = '';
                    var mSelectedItem = '';
                    var pCond = '';
                    var strType = '';
                    var UID = 0;
                    var LOGIN_NAME = '';
                    var SYSTEM_USER_ID = '';
                    var SelActions = [];
                    var Mode = '';
                    var strResponse = '';
                    var param = appRequest.body.PARAMS;
                    var strQuery = '';
                    var delQuery = '';
                    sharetransaction(param);

                    // Query transaction allocation for user/role mode
                    function sharetransaction(params) {
                        // params.SELROW = params.SELROW.replace(/\\/g, '');
                        var dtTranAllctnData = [];
                        try {
                            Mode = params.MODE;
                            pCond = params.COND;
                            if (Mode == 'USER') {
                                pCond = pCond + ' and ALLOCATED_APPU_ID IS NOT NULL ';
                            } else if (Mode = "ROLE") {
                                pCond = pCond + " and ALLOCATED_APPR_ID IS NOT NULL ";
                            }
                            if (pCond != '')
                                var query = TRANALLOC + 'WHERE ' + pCond;

                            strType = params.ATYPE;
                            UID = session_info.U_ID;
                            LOGIN_NAME = session_info.LOGIN_NAME;
                            // SelActions = params("SELACTIONS")
                            SYSTEM_USER_ID = params.SYSTEM_USER_ID;
                            var selrows = params.SELITEMS;
                            mSelectedItem = selrows;
                            reqTranDBInstance.ExecuteSQLQuery(mTranDB, query, objLogInfo, function callbackExecuteSQL(pRes, pErr) {
                                try {
                                    if (pErr) {
                                        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41021', 'Error in sharetransaction function', error);
                                    } else {
                                        dtTranAllctnData = pRes.rows;
                                        if (Mode == "USER" && mSelectedItem != '') {
                                            var strIdColumnName = "ALLOCATED_APPU_ID";
                                            var dtusers = [];
                                            dtusers = params.SELROW;
                                            useractions(dtusers, dtTranAllctnData, params, function (res) { });
                                        }
                                        if (Mode == "ROLE" && mSelectedItem != '') {
                                            var strIdColumnName = "ALLOCATED_APPR_ID";
                                            var dtRoles = [];
                                            dtRoles = params.SELROW;
                                            roleactions(dtRoles, dtTranAllctnData, params, function (res) { });
                                        }
                                    }
                                } catch (error) {
                                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41001', 'Error in sharetransaction function', error);
                                }
                            });

                            //to be implemented for system
                            // if (Mode=="SYSTEM") AndAlso mSelectedItem.Rows.Count > 0 Then Dim dtsystem As JArray = JsonConvert.DeserializeObject(Of JArray)(params("SELROW")) For Each itm As Object In dtsystem __AddChildTranRow(htInsertTrnAllocatn, htUpdateTrnAllocatn, htDeleteTrnAllocatn, itm, dtTranAllctnData, UID, SYSTEM_USER_ID, mSelectedItem, strType, SelActions, params) Next End If
                            // htTmpTranAllocatn = htUpdateTrnAllocatn
                            // if (htUpdateTrnAllocatn != '' && htUpdateTrnAllocatn.Count > 0) {
                            //     objupdate.Update(htTmpTranAllocatn, "TA_ID", "")
                            // }    
                        } catch (error) {
                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41002', 'Execption Occured', error);
                        }
                    }

                    // User Roles performed 
                    function roleactions(dtRoles, dtTranAllctnData, params, pcallback) {
                        try {
                            _PrintInfo('Sahre with Roles');
                            var roleschecked = [];
                            var rolesunchecked = [];
                            var strIdColumnName = "ALLOCATED_APPR_ID";
                            async.series([
                                function (callbackasync) {
                                    async.forEachOfSeries(dtRoles, function (value, key, callback) {
                                        var drU = dtRoles[key];
                                        SelActions = drU.TAA_CODE;

                                        if (drU.IS_CHECKED) {
                                            roleschecked.push(drU);
                                        } else if (drU.IS_CHECKED == false) {
                                            rolesunchecked.push(drU);
                                        }
                                        callback();
                                    }, function (err) {
                                        if (err) {

                                        } else {
                                            callbackasync();
                                        }
                                    });
                                },
                                function (callbackasync1) {
                                    async.forEachOfSeries(roleschecked, function (value, key, callback1) {
                                        var drU = roleschecked[key];
                                        var OldUsers = new reqLINQ(dtTranAllctnData)
                                            .Where(function (dr) {
                                                return dr.allocated_appr_id !== '' && dr.allocated_appr_id === drU.APPR_ID;
                                            }).ToArray();
                                        if (OldUsers.length > 0) {
                                            _PrintInfo('Update Roles case');
                                            exquery = TRANALLOCACTION + ' WHERE ' + 'TA_ID=' + drU.TA_ID;
                                            htUpdateTrnAllocatn = __InsertNewTranRow(UID, SYSTEM_USER_ID, htUpdateTrnAllocatn, 'ALLOCATED_APPR_ID', drU.APPR_ID, "ROLE", "UPDATE", OldUsers[0].ta_id, mSelectedItem, strType, drU.LOGIN_NAME, params);
                                            //Update the Attachment actions
                                            reqTranDBInstance.ExecuteSQLQuery(mTranDB, exquery, objLogInfo, function (Res, pErr) {
                                                try {
                                                    if (Res) {
                                                        var res = Res;
                                                        _PrintInfo('Success');
                                                        SaveAttachmentAction(Res, drU.TAA_CODE, drU.TA_ID, function (res) {
                                                            DeleteActions(drU.TAA_CODE, drU.TA_ID, 'SELECTED', function (deleRes) {
                                                                _PrintInfo('Unassigned actions are deleted successfully.');
                                                                callback1();
                                                            });
                                                        });
                                                    } else {
                                                        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40402', 'Execption Occured in TranAllocation' + pErr, '');
                                                    }
                                                } catch (error) {
                                                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-40402', 'Error in TranAllocation execution', error);
                                                }
                                            });

                                        } else {
                                            //New Role case
                                            __InsertNewRow(UID, SYSTEM_USER_ID, [], strIdColumnName, drU.APPR_ID, "ROLE", "INSERT", 0, mSelectedItem, strType, drU.TAA_CODE, drU.ROLE_CODE, drU.ROLE_DESCRIPTION, params, function (res) {
                                                callback1();
                                            });
                                        }
                                    }, function (err) {
                                        if (err) {

                                        } else {
                                            _PrintInfo('CHECKED Roles' + JSON.stringify(roleschecked));
                                            callbackasync1();
                                        }
                                    });
                                },
                                function (callbackasync2) {
                                    async.forEachOfSeries(rolesunchecked, function (value, key, callback2) {
                                        var drU = rolesunchecked[key];
                                        if (typeof drU.TAA_CODE === 'string') {
                                            var Actions = JSON.parse(drU.TAA_CODE.replace(/\\/g, ''));
                                        }

                                        if (drU.TA_ID > 0) {
                                            // strQuery = "Delete from TRANSACTION_ALLOCATIONS where TA_ID in (" + OldUsers[0].ta_id + ");"
                                            reqTranDBInstance.DeleteTranDB(mTranDB, 'TRANSACTION_ALLOCATIONS', {
                                                ta_id: drU.TA_ID
                                            }, objLogInfo, function (pRes) {
                                                if (pRes) {
                                                    _PrintInfo('TRANSACTION_ALLOCATIONS DELETED');
                                                    DeleteActions(Actions, drU.TA_ID, 'ALL', function (callback) {
                                                        _PrintInfo('ACTIONS DELETED');
                                                        callback2();
                                                    });
                                                } else {
                                                    callback2();
                                                }
                                            });
                                        } else {
                                            callback2();
                                        }
                                    }, function (err) {
                                        if (err) {

                                        } else {
                                            callbackasync2();
                                        }
                                    });
                                }
                            ],
                                function (final) {
                                    reqInsHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '');
                                });
                        } catch (error) {
                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41003', 'Error in roleactions Function', error);
                        }
                    }

                    // Delete Actions from TRANSACTION_ALLOCATION_ACTIONS
                    function DeleteActions(pTAA_CODE, pta_id, pWhichAction, callback) {
                        try {
                            var Actions = '';
                            if (typeof pTAA_CODE === 'string') {
                                Actions = JSON.parse(pTAA_CODE.replace(/\\/g, ''));
                            }
                            Actions = pTAA_CODE;
                            if (pWhichAction == 'ALL') {
                                var cond = {};
                                cond.ta_id = pta_id;
                                // to delete all action action allocation
                                reqTranDBInstance.DeleteTranDB(mTranDB, 'TRANSACTION_ALLOCATION_ACTIONS', cond, objLogInfo, function (pRes) {
                                    if (pRes) {
                                        _PrintInfo('ALL TRANSACTION_ALLOCATIONS_ACTIONS DELETED for ' + pta_id);
                                        callback('SUCCESS');
                                    }
                                });
                            } else {
                                async.forEachOfSeries(Actions, function (actionstr, index, asyncdelcallback) {
                                    if (actionstr.IS_CHECKED == false) {
                                        var cond = {};
                                        cond.ta_id = pta_id;
                                        cond.action_code = actionstr.ACTION_CODE;

                                        // to delete remove  action against the allocation
                                        reqTranDBInstance.DeleteTranDB(mTranDB, 'TRANSACTION_ALLOCATION_ACTIONS', cond, objLogInfo, function (pRes) {
                                            if (pRes) {
                                                _PrintInfo('TRANSACTION_ALLOCATIONS_ACTIONS DELETED');
                                                asyncdelcallback();
                                            }
                                        });
                                    } else {
                                        asyncdelcallback();
                                    }
                                }, function (error) {
                                    if (error) {
                                    } else {
                                        callback('SUCCESS');
                                    }
                                });

                            }
                        } catch (error) {
                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41004', 'Error in DeleteActions Function', error);
                        }
                    }

                    // Insert assigned user actions to TRANSACTION_ALLOCATION_ACTIONS
                    function useractions(dtusers, dtTranAllctnData, params, pcallback) {
                        _PrintInfo('Sahre with user');
                        var lstSelectedTran = [];
                        try {
                            var d = q.defer();
                            var count = 0;
                            var userchked = [];
                            var userunchk = [];
                            var strIdColumnName = '';
                            var OldUsers = "";
                            var exquery = '';
                            async.series([
                                function (callbackasync) {
                                    async.forEachOfSeries(dtusers, function (value, key, callback) {
                                        var drU = dtusers[key];
                                        SelActions = drU.TAA_CODE;
                                        if (drU.IS_CHECKED) {
                                            userchked.push(drU);
                                        } else if (drU.IS_CHECKED == false) {
                                            userunchk.push(drU);
                                        }
                                        callback();
                                    }, function (err) {
                                        if (err) {

                                        } else {
                                            callbackasync();
                                        }
                                    });

                                },
                                function (callbackasync1) {
                                    var strarray = [];
                                    // To insert new users and actions
                                    // To insert action for old users
                                    _PrintInfo('insert into transaction_alloaction - Started');
                                    async.forEachOfSeries(userchked, function (value, key, callback1) {
                                        var drU = userchked[key];
                                        OldUsers = new reqLINQ(dtTranAllctnData)
                                            .Where(function (dr) {
                                                return dr.allocated_appu_id !== '' && dr.allocated_appu_id === drU.APPU_ID;
                                            }).ToArray();
                                        // Old user case
                                        if (OldUsers.length > 0) {
                                            _PrintInfo('Update allocation case');
                                            exquery = TRANALLOCACTION + ' WHERE ' + 'TA_ID=' + drU.TA_ID;
                                            htUpdateTrnAllocatn = __InsertNewTranRow(UID, SYSTEM_USER_ID, htUpdateTrnAllocatn, 'ALLOCATED_APPU_ID', drU.APPU_ID, "USER", "UPDATE", OldUsers[0].ta_id, mSelectedItem, strType, drU.LOGIN_NAME, params);
                                            // Update the Attachment actions
                                            reqTranDBInstance.ExecuteSQLQuery(mTranDB, exquery, objLogInfo, function (Res) {
                                                try {
                                                    if (Res) {
                                                        var res = Res;
                                                        SaveAttachmentAction(Res, drU.TAA_CODE, drU.TA_ID, function (res) {
                                                            if (res) {
                                                                DeleteActions(drU.TAA_CODE, drU.TA_ID, 'SELECTED', function (res) {
                                                                    _PrintInfo('Unassigned actions are deleted successfully');
                                                                    callback1();
                                                                });
                                                            }
                                                        });
                                                    } else {
                                                        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41005', 'Error in ', '');
                                                    }
                                                } catch (error) {
                                                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41006', 'Error Occured', error);
                                                }
                                            });

                                        } else {
                                            // New user case
                                            _PrintInfo('New Insert case');
                                            __InsertNewRow(UID, SYSTEM_USER_ID, [], strIdColumnName, drU.APPU_ID, "USER", "INSERT", 0, mSelectedItem, strType, drU.TAA_CODE, drU.LOGIN_NAME, '', params, function (tes) {
                                                reqSrvHlpr.ParseSelectedTran(lstSelectedTran, [mSelectedItem], drU['LOGIN_NAME'], drU['EMAIL_ID']);
                                                callback1();
                                            });

                                        }
                                    }, function (err) {
                                        if (err) {

                                        } else {
                                            _PrintInfo('insert into transaction_alloaction - End ');
                                            _PrintInfo('CHECKED' + JSON.stringify(userchked));
                                            callbackasync1();
                                        }
                                    });
                                },
                                function (callbackasync2) {
                                    try {
                                        _PrintInfo('Unchecked data process - Started');
                                        async.forEachOfSeries(userunchk, function (value, key, callback2) {
                                            var drU = userunchk[key];
                                            if (typeof drU.TAA_CODE === 'string') {
                                                var Actions = JSON.parse(drU.TAA_CODE.replace(/\\/g, ''));
                                            }
                                            if (drU.TA_ID > 0) {
                                                // strQuery = "Delete from TRANSACTION_ALLOCATIONS where TA_ID in (" + OldUsers[0].ta_id + ");"
                                                reqTranDBInstance.DeleteTranDB(mTranDB, 'TRANSACTION_ALLOCATIONS', {
                                                    ta_id: drU.TA_ID
                                                }, objLogInfo, function (pRes) {
                                                    if (pRes) {
                                                        _PrintInfo('TRANSACTION_ALLOCATIONS DELETED');
                                                        //Delete All allocatoin action
                                                        DeleteActions(Actions, drU.TA_ID, "ALL", function (callback) {
                                                            _PrintInfo('ACTIONS DELETED');
                                                            callback2();
                                                        });
                                                    } else {
                                                        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41007', 'Error in TRANSACTION_ALLOCATIONS DELETE', '');
                                                    }
                                                });
                                            } else {
                                                callback2();
                                            }
                                        }, function (err) {
                                            if (err) {

                                            } else {
                                                _PrintInfo('Unchecked data process - Ended');
                                                callbackasync2();
                                            }
                                        });
                                    } catch (error) {
                                        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41008', 'Error in DeleteActions function', error);
                                    }
                                }
                            ],
                                function (final) {
                                    if (lstSelectedTran.length > 0) {
                                        _PrintInfo('Check communication if mail setup available and send mail the doc');
                                        reqSrvHlpr.SendMail(mClient, '', 'DOC_SHARING_TEMPLATE', lstSelectedTran, 'SHARE_TRANSACTION', objLogInfo, pHeaders, {
                                            SessionInfo: session_info
                                        }, function callbackSendDeleteContentMail(pStatus) {
                                            _PrintInfo('api End');
                                            reqInsHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '');
                                        });
                                    } else {
                                        reqInsHelper.SendResponse(strServiceName, appResponse, 'SUCCESS', objLogInfo, '', '', '');

                                    }
                                });
                        } catch (error) {
                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41010', 'Exception Occured', error);
                        }
                    }

                    // Prepare object for inserting new tran allocation row
                    function __InsertNewTranRow(UID, SYSTEM_USER_ID, pDtTmpTranAll, pIdColumnName, pId, pMode, pProcessType, pTAId, mSelectedItem, strAlloctnType, strLoginName, pParams) {
                        try {
                            var LOGIN_NAME = "";
                            var SYSTEM_DESC = "";
                            if (pParams.LOGIN_NAME && pParams.LOGIN_NAME != null && pParams.LOGIN_NAME != '') {
                                LOGIN_NAME = pParams.LOGIN_NAME;
                            }
                            if (pParams.SYSTEM_DESC != '') {
                                SYSTEM_DESC = pParams.SYSTEM_DESC;
                            }
                            //Dim dr As DataRow = pDtTmpTran.NewRow
                            var pDtTmpTran = {};
                            switch (strAlloctnType) {
                                case "TRAN":
                                    pDtTmpTran.ITEM_ID = mSelectedItem.ts_id;
                                    pDtTmpTran.ITEM_TYPE = 'TRAN';
                                    break;
                                case "ATMT":
                                    pDtTmpTran.ITEM_ID = mSelectedItem.trna_id;
                                    pDtTmpTran.ITEM_TYPE = 'ATMT';
                                    break;
                                case "RPT":
                                    pDtTmpTran.ITEM_ID = mSelectedItem.rpt_ah_id;
                                    pDtTmpTran.ITEM_TYPE = 'RPT';
                                    break;
                                case "DTT":
                                    pDtTmpTran.ITEM_ID = mSelectedItem.dtt_id;
                                    pDtTmpTran.ITEM_TYPE = 'DTT';
                                    break;
                                case "DT":
                                    pDtTmpTran.ITEM_ID = mSelectedItem.dt_id;
                                    pDtTmpTran.ITEM_TYPE = 'DT';
                                    break;
                                case "AK":
                                    pDtTmpTran.ITEM_ID = mSelectedItem.dttak_id;
                                    pDtTmpTran.ITEM_TYPE = 'AK';
                                    break;
                                case "DTTA":
                                    pDtTmpTran.ITEM_ID = mSelectedItem.dtta_id;
                                    pDtTmpTran.ITEM_TYPE = 'DTTA';
                                    break;
                                default:
                                    break;
                            }

                            pDtTmpTran.TA_ID = pTAId;
                            if (pMode == "USER") {
                                pDtTmpTran.ALLOCATED_APPU_ID = pId;
                                pDtTmpTran.ALLOCATED_APPUSER_NAME = strLoginName;
                            } else if (pMode == "ROLE") {
                                pDtTmpTran.ALLOCATED_APPR_ID = pId;
                                pDtTmpTran.ALLOCATED_ROLE_DESCRIPTION = strLoginName;
                            } else {
                                pDtTmpTran.ALLOCATED_SYSTEM_NAME = strLoginName;
                            }
                            if (pProcessType == "INSERT") {
                                pDtTmpTran.CREATED_BY = UID;
                                pDtTmpTran.CREATED_BY_NAME = LOGIN_NAME;
                                pDtTmpTran.SYSTEM_NAME = SYSTEM_DESC;
                                pDtTmpTran.CREATED_DATE = DateTime.Now;
                            }
                            if (pProcessType == "UPDATE") {
                                pDtTmpTran.MODIFIED_BY = SYSTEM_USER_ID;
                                pDtTmpTran.MODIFIED_BY_NAME = LOGIN_NAME;
                                // pDtTmpTran.Add("MODIFIED_BY_SYSTEM_DESC", SYSTEM_DESC)
                                pDtTmpTran.MODIFIED_DATE = reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo);
                            }

                            pDtTmpTranAll = pDtTmpTran;
                            _PrintInfo('Preparing new insert tranrow completed');
                            return pDtTmpTranAll;
                        } catch (error) {
                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41011', 'Error in __InsertNewTranRow function', error);
                        }
                    }

                    // Prepare and insert new transcation allocation row
                    function __InsertNewRow(UID, SYSTEM_USER_ID, htinsertTransaction, pIdColumnName, pId, pMode, pProcessType, pTAId, mSelectedItem, strAlloctnType, pSelAction, strLoginName, strRoleDesc, pParams, callback) {
                        try {
                            var SYSTEM_DESC = "";
                            if (pParams.LOGIN_NAME && pParams.LOGIN_NAME != '') {
                                LOGIN_NAME = pParams.LOGIN_NAME;
                            }
                            if (pParams.SYSTEM_DESC != '') {
                                SYSTEM_DESC = pParams.SYSTEM_DESC;
                            }

                            var htinsertTran = {};
                            switch (strAlloctnType) {
                                case "TRAN":
                                    htinsertTran.ITEM_ID = mSelectedItem.ts_id;
                                    htinsertTran.ITEM_TYPE = 'TRAN';
                                    break;
                                case "ATMT":
                                    htinsertTran.ITEM_ID = mSelectedItem.trna_id;
                                    htinsertTran.ITEM_TYPE = 'ATMT';
                                    break;
                                case "RPT":
                                    htinsertTran.ITEM_ID = mSelectedItem.rpt_ah_id;
                                    htinsertTran.ITEM_TYPE = 'RPT';
                                    break;
                                case "DTT":
                                    pDtTmpTran.ITEM_ID = mSelectedItem.dtt_id;
                                    pDtTmpTran.ITEM_TYPE = 'DTT';
                                    break;
                                case "DT":
                                    pDtTmpTran.ITEM_ID = mSelectedItem.dt_id;
                                    pDtTmpTran.ITEM_TYPE = 'DT';
                                    break;
                                case "AK":
                                    pDtTmpTran.ITEM_ID = mSelectedItem.dttak_id;
                                    pDtTmpTran.ITEM_TYPE = 'AK';
                                    break;
                                case "DTTA":
                                    pDtTmpTran.ITEM_ID = mSelectedItem.dtta_id;
                                    pDtTmpTran.ITEM_TYPE = 'DTTA';
                                    break;
                                default:
                                    break;
                            }

                            //  htinsertTran.TA_ID = pTAId
                            if (pMode == "USER") {
                                htinsertTran.ALLOCATED_APPU_ID = pId;
                                htinsertTran.ALLOCATED_APPUSER_NAME = strLoginName;
                            } else if (pMode == "ROLE") {
                                htinsertTran.ALLOCATED_APPR_ID = pId;
                                htinsertTran.ALLOCATED_ROLE_DESCRIPTION = strLoginName; //Role code
                                htinsertTran.ALLOCATED_APPUSER_NAME = strRoleDesc;   // pupose of need to show the same column for user and role in list view
                            } else {
                                htinsertTran.ALLOCATED_SYSTEM_NAME = strLoginName;
                            }
                            if (pProcessType == "INSERT") {
                                //htinsertTran.SYSTEM_NAME = SYSTEM_DESC
                                htinsertTran.APP_ID = objLogInfo.APP_ID;
                                htinsertTran.TENANT_ID = objLogInfo.TENANT_ID;
                            }
                            htinsertTransaction.push(htinsertTran);
                            if (htinsertTransaction != '') {

                                reqTranDBInstance.InsertTranDBWithAudit(mTranDB, 'TRANSACTION_ALLOCATIONS', htinsertTransaction, objLogInfo, function callbackExecuteSQL(pRes) {
                                    _PrintInfo("Insert success" + pRes[0].ta_id);
                                    htinsertTransaction = [];
                                    var exquery = TRANALLOCACTION + ' WHERE ' + 'TA_ID=' + pRes[0].ta_id;
                                    //Add attachment action    
                                    reqTranDBInstance.ExecuteSQLQuery(mTranDB, exquery, objLogInfo, function (Res, pErr) {
                                        try {
                                            if (Res) {
                                                var res = Res;
                                                SaveAttachmentAction(res, pSelAction, pRes[0].ta_id, function (res) {
                                                    callback();
                                                });
                                            } else {
                                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41028', 'Error  occured  execute query' + pErr, pErr);
                                            }
                                        } catch (error) {
                                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41027', 'Exception occured  execute query', error);
                                        }
                                    });
                                });
                            }
                        } catch (error) {
                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41012', 'Error in __InsertNewTranRow function', error);
                        }
                    }

                    // Insert trnascation allocation_actions
                    function SaveAttachmentAction(pres, pSelActions, pTAId, pcallback) {
                        try {
                            var hshInsertLst = [];
                            var hshDeleteLst = [];
                            var dtTranAllcAttData = [];
                            var objActionList = [];
                            //   pSelActions.replace(/\\/g, '')
                            if (typeof pSelActions === 'string') {
                                pSelActions = JSON.parse(pSelActions.replace(/\\/g, ''));
                            }

                            objActionList = pSelActions;

                            dtTranAllcAttData = pres.rows;
                            objActionList.forEach(function (actRow) {
                                var Row = actRow;
                                var OldAction = new reqLINQ(dtTranAllcAttData)
                                    .Where(function (AttAction) {
                                        return AttAction.action_code !== '' && AttAction.action_code === Row.ACTION_CODE;
                                    }).ToArray();
                                if (OldAction.length > 0) {
                                    if (Row.IS_CHECKED) {
                                        //There is no action handled because currently is checked true
                                    } else
                                        // delete Action that entered previously ,because currently checked false
                                        hshDeleteLst = __AddAction(pTAId, Row.ACTION_CODE, Row.ACTION_DESCRIPTION, hshDeleteLst);
                                } else {
                                    //Insert new action code if not exists
                                    if (Row.IS_CHECKED) {
                                        hshInsertLst = __AddAction(pTAId, Row.ACTION_CODE, Row.ACTION_DESCRIPTION, hshInsertLst);
                                    }
                                }
                            });

                            // insert new action code
                            //  Dim ent1 As New Entity("TRANSACTION_ALLOCATION_ACTIONS")
                            if (hshInsertLst.length > 0) {
                                reqTranDBInstance.InsertTranDBWithAudit(mTranDB, 'TRANSACTION_ALLOCATION_ACTIONS', hshInsertLst, objLogInfo, function (pRes) {
                                    if (pRes) {
                                        deleteaction();
                                    }
                                    _PrintInfo('TRANSACTION_ALLOCATION_ACTIONS inserted successfully');
                                });
                            } else {
                                deleteaction();
                            }

                            function deleteaction() {
                                try {
                                    _PrintInfo('Delete allocation action - Started');
                                    if (hshDeleteLst.length > 0) {
                                        reqTranDBInstance.DeleteTranDB(mTranDB, 'TRANSACTION_ALLOCATION_ACTIONS', hshDeleteLst, objLogInfo, function (pRes) {
                                            if (pRes) {
                                                pcallback('SUCCESS');
                                            }
                                        });
                                    } else {
                                        _PrintInfo('Delete allocation action - Ended');
                                        pcallback('SUCCESS');
                                    }
                                } catch (error) {
                                    reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41029', 'Exception occured deleteaction ', error);
                                }
                            }

                        } catch (error) {
                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41013', 'Error in SaveAttachmentAction function', error);
                        }
                    }
                });
            });
        });
    } catch (error) {
        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41014', 'Error in SHARE_TRANSACTION function', error);
    }
    // Prepare a new action (TA) object
    function __AddAction(pTA_ID, pActionCode, pActionDescription, hshLst) {
        var hsh = {};
        hsh.TA_ID = pTA_ID;
        hsh.ACTION_CODE = pActionCode;
        hsh.ACTION_DESCRIPTION = pActionDescription;
        hsh.APP_ID = objLogInfo.APP_ID;
        hsh.TENANT_ID = objLogInfo.TENANT_ID;
        hshLst.push(hsh);
        return hshLst;
    }

    // Send mail for allocated users and role users based on setup
    function _SendMail(pOTPSMSTemplate, pOTPMailTemplate, pData, pCallback) {
        var msgvalue = 0;
        var strResult = '';
        var strOTPSMSTemplate = '';
        var strOTPMAILTemplate = '';
        try {

            if (pOTPSMSTemplate != '')
                strOTPSMSTemplate = pOTPSMSTemplate;

            if (pOTPMailTemplate != '')
                strOTPMAILTemplate = pOTPMailTemplate;

            _PrepareMsgData(strOTPSMSTemplate, strOTPMAILTemplate, 'DELETE_CONTENT', function callbackPrepareMsgData(pTemplates) {
                var objMsgTemplts = pTemplates;
                for (var i = 0; i < objMsgTemplts.length; i++) {
                    var objMsgTemp = objMsgTemplts[i];
                    if (objMsgTemp.CATEGORY_INFO.COMMC_CONFIG.CONFIG.TYPE.toUpperCase() == "MAIL")
                        objCommtn.SendMessage(objMsgTemp, pData, "", "");
                }
                pCallback('SUCCESS');
            });

        } catch (error) {
            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41015', 'Error in _SendMail function', error);
        }
        return strResult;
    }

    // Prepare mail object for sending mail
    function _PrepareMsgData(pOTPSMSTemp, pOTPMailTemp, pType, pCallback) {
        var objMsgTemplts = [];
        var authenticationmodel = 'MAIL';
        try {
            if (authenticationmodel == 'MAIL')
                pOTPSMSTemp = "";
            else if (authenticationmodel == 'SMS')
                pOTPMailTemp = "";

            _GetCommMsgTemplate(pOTPSMSTemp, pOTPMailTemp, function callbackGetCommMsgTemplate(pTemplates) {
                var lstComm = pTemplates;

                if (lstComm.length == 0) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, 'FAILURE', objLogInfo, 'ERR-HAN-41019', 'communication info setup is Missing. Please contact your Administrator', '');
                    _PrintInfo('Communication info setup is Missing');
                } else {
                    for (var i = 0; i < lstComm.length; i++) {
                        var rw = lstComm[i];
                        var objMsgTemplt = {};
                        objMsgTemplt.CATEGORY_INFO = JSON.parse(rw['category_info']);
                        objMsgTemplt.TEMPLATE_INFO = JSON.parse(rw['template_info']);

                        if (pType == 'DELETE_CONTENT')
                            objMsgTemplt.CONTACT_INFOs = JSON.parse(rw['contact_info']);
                        else {
                            var TOC = [{
                                ADDRESS_TYPE: 'TO',
                                COLUMN_NAME: 'to_doc_share',
                                STATIC_ADDRESS: ''
                            }];
                            objMsgTemplt.CONTACT_INFOs = TOC;
                        }
                        objMsgTemplts.push(objMsgTemplt);
                    }
                }
                pCallback(objMsgTemplts);
            });
        } catch (error) {
            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41016', 'Error in _PrepareMsgData function', error);

        }
        //return objMsgTemplts
    }

    function _GetCommMsgTemplate(pOTPSMSTemp, pOTPMailTemp, pCallback) {
        try {
            var lstComm = [];
            if (pOTPSMSTemp != '' && pOTPMailTemp == "")
                mDepCas.execute(COMMINFO, [pOTPSMSTemp], {
                    prepare: true
                }, function callbackGetCommInfo(pError, pResult) {
                    if (pError) {
                        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41017', 'Error in _PrepareMsgData function', pError);
                    } else if (pResult) {
                        lstComm = pResult.rows;
                    }
                    pCallback(lstComm);
                });
            else if (pOTPMailTemp != '' && pOTPSMSTemp == '')
                mDepCas.execute(COMMINFO, [pOTPMailTemp], {
                    prepare: true
                }, function callbackGetCommInfo(pError, pResult) {
                    if (pError)
                        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41018', 'Error in _PrepareMsgData function', pError);
                    else if (pResult) {
                        lstComm = pResult.rows;
                    }
                    pCallback(lstComm);
                });
        } catch (error) {
            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41020', 'Error in _PrepareMsgData function', error);
        }
    }

    // Print Log information
    function _PrintInfo(pMessage) {
        reqInsHelper.PrintInfo(strServiceName, pMessage, objLogInfo);
    }
});


module.exports = router;
/********* End of Service *******/