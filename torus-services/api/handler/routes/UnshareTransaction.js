/*
@Api_Name           : /UnshareTransaction,
@Description        : To Unassign all the Shared Transactions and attachments for the users amd roles 
@Last_Error_code    : ERR-HAN-41205 
*/

// Require dependencies
var reqExpress = require('express');
var reqHashTable = require('jshashtable');
var router = reqExpress.Router();
var reqLINQ = require('node-linq').LINQ;
var reqTranDBInstance = require('../../../../torus-references/instance/TranDBInstance');
var reqLogWriter = require('../../../../torus-references/log/trace/LogWriter')
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo')
var reqInsHelper = require('../../../../torus-references/common/InstanceHelper');

// Global variable initialization
var strOrm = 'knex';
var mClient;
var mTranDB;
var pHeaders = '';

var strServiceName = 'UnshareTransaction'
var strDeleteActionQry = "delete from transaction_allocation_actions where ta_id in" +
    " (select ta_id from transaction_allocations where item_id = $ITEM_ID and item_type = '$ITEM_TYPE')";

// Host api to server
router.post('/UnshareTransaction', function(appRequest, appResponse) {
    var objLogInfo = ''
    try {
        pHeaders = appRequest.headers;
        reqLogInfo.AssignLogInfoDetail(appRequest, function(LogInfo, session_info) {

            // Handle the close event when client close the connection 
            appResponse.on('close', function() {});
            appResponse.on('finish', function() {});
            appResponse.on('end', function() {});

            objLogInfo = LogInfo
            reqTranDBInstance.GetTranDBConn(pHeaders, false, function(pSession) {
                mTranDB = pSession;
                objLogInfo.HANDLER_CODE = 'SHARE_CONTENT'
                _PrintInfo("Begin")

                UNSHARE_TRANSACTION(appRequest.body.PARAMS, function(result) {
                    reqInsHelper.SendResponse(strServiceName, appResponse, result, objLogInfo, null, null);
                })

                //main function For Unshare
                function UNSHARE_TRANSACTION(pClientparams, callback) {
                    try {
                        var Nodetype = pClientparams.NODE_TYPE;
                        var DTT_CODE = pClientparams.DTT_CODE;
                        var Strvalue = "";
                        var strKeyClmn = "";
                        var oCheckedRows = JSON.parse(pClientparams.SelectedRow);

                        var oKeyColumn = "";
                        var strResponse = "";

                        if (typeof Nodetype == "string" && Nodetype != "") {
                            if (Nodetype == "TRAN") {
                                oKeyColumn = "TS_ID";
                            } else if (Nodetype == "ATMT") {
                                oKeyColumn = "TRNA_ID";
                            } else if (Nodetype == "RPT") {
                                oKeyColumn = "RPT_AH_ID";
                            } else if (Nodetype == "DTT") {
                                oKeyColumn = "DTT_ID";
                            } else if (Nodetype == "DT") {
                                oKeyColumn = "DT_ID"
                            } else if (Nodetype == "AK") {
                                oKeyColumn = "DTTAK_ID"
                            } else if (Nodetype == "DTTA") {
                                oKeyColumn = "DTTA_ID"
                            }
                        }
                        if (oCheckedRows && oKeyColumn != '') {
                            var Strvalue = oCheckedRows[0].trna_id;
                            _PrintInfo("Selected trna_id is " + Strvalue);
                        }

                        if (Strvalue != '') {
                            DeleteSaveAllocation(Nodetype, Strvalue, function callbackDeleteSaveAllocation(result) {
                                callback(result);
                            });
                        } else {
                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, '', '', '', "FAILURE", 'No Trna_id Found');
                        }

                    } catch (error) {
                        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41102', 'Error in UNSHARE_TRANSACTION', error);
                    }

                }


                // Delete allocated rows
                function DeleteSaveAllocation(pItmtype, pItmid, pCallback) {
                    // Delelete Allocation actions first
                    DeleteAllocationActions(pItmtype, pItmid, function CallbackDelAllocActions(pRes) {
                        pCallback(pRes);
                    })
                }

                // Delete Allocations from TRANSACTION_ALLOCATIONS against the Item id - TRN/TRNA
                function DeleteAllocation(pItmtype, pItmid, pCallback) {
                    try {
                        reqTranDBInstance.DeleteTranDB(mTranDB, 'TRANSACTION_ALLOCATIONS', {
                            item_id: pItmid,
                            item_type: pItmtype
                        }, objLogInfo, function(pRes, pError) {
                            if (pError) {
                                reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41103', 'Error in Delete tran allocation ', pError);
                            } else {
                                pCallback('SUCCESS')
                            }
                        });
                    } catch (error) {
                        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41104', 'Error in DeleteAllocation', error);
                    }
                }

                // Function for Delete Allocation Actions
                function DeleteAllocationActions(pItmtype, pItmid, pCallback) {
                    var tmpDelQry = strDeleteActionQry.replace('$ITEM_ID', pItmid);
                    tmpDelQry = tmpDelQry.replace('$ITEM_TYPE', pItmtype);
                    reqTranDBInstance.ExecuteSQLQuery(mTranDB, tmpDelQry, objLogInfo, function CallbackExecQuery(pRes, pError) {
                        if (pError) {
                            reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41105', 'Error in Delete tran allocation action', pError);
                        } else {
                            // If action delete is SUCCESS, delete main allocation entry
                            DeleteAllocation(pItmtype, pItmid, function CallbackDelAlloc(pRes) {
                                if (pRes == 'SUCCESS') {
                                    pCallback(pRes);
                                }
                            });
                        }
                    })
                }
            });
        })
    } catch (error) {
        reqInsHelper.SendResponse(strServiceName, appResponse, null, objLogInfo, 'ERR-HAN-41106', 'Error in DeleteAllocationActions function', error);
    }
    //Print Info
    function _PrintInfo(pMessage) {
        reqInsHelper.PrintInfo(strServiceName, pMessage, objLogInfo)
    }
});

module.exports = router;
/********* End function **********/