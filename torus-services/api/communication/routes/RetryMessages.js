/**
 * Api_Name         : /MailSms
 * Description      : To Retry the messages for Mail or SMS  Failure cases 
 * Last ErrorCode   : ERR-COM-26003
 */

// Require dependencies
var modPath = '../../../../node_modules/';
var refPath = '../../../../torus-references/';
var reqExpress = require(modPath + 'express');
var reqLinq = require(modPath + 'node-linq').LINQ;
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqProducer = require('../../../../torus-references/common/Producer');
const { retry } = require('async');
var router = reqExpress.Router();
// Service Definition
router.post('/RetryMessages', function (appRequest, appResponse) {
    appResponse.setHeader('Content-Type', 'text/plain');

    var strReqHeader = appRequest.headers;
    var strInputParam = appRequest.body.PARAMS.CommpmID;
    var objLogInfo;
    var mTranDB;
    var SessionInfo;

    try {
        reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLogInfoDetail(pLogInfo, pSessionInfo) {
            SessionInfo = pSessionInfo;
            objLogInfo = pLogInfo;
            objLogInfo.HANDLER_CODE = 'RETRYMESSAGES';
            _PrintInfo('Begin');
            // Initialize the DB
            _InitializeTrnDB(strReqHeader, function callbackInitializeDB(pStatus) {
                _PrintInfo('TranDB initialized successfully');
                try {
                    //Query the Comm_Process_Message for get the currentInput Values
                    reqTranDBHelper.GetTableFromTranDB(mTranDB, 'COMM_PROCESS_MESSAGE', {
                        commpm_id: strInputParam
                    }, objLogInfo, function callback(pResult, pError) {
                        if (pError) {
                            console.log(pError);
                        } else {
                            if (pResult.length > 0) {
                                _PrintInfo('After Get the data in COMM_PROCESS_MESSAGE table');
                                var result = pResult[0];
                                // if (result.parent_commpm_id) {
                                //     result.parent_commpm_id = result.parent_commpm_id;
                                // } else {
                                //     result.parent_commpm_id = result.commpm_id;
                                // }
                                //delete result.commpm_id;
                                //delete result.comments;
                                result.created_date = reqDateFormatter.GetTenantCurrentDateTime(strReqHeader, objLogInfo);
                                result.attempt_count = result.attempt_count + 1;
                                result.status = 'CREATED';
                                //Insert the getting value to COMM_PROCESS_MESSAGE TABLE for FAILURE CASE
                                // InsertComnProcessMessage(result, function insertCallback() { });
                                var whereCond = {
                                    commpm_id: result.commpm_id
                                }
                                var updateRow = {
                                    attempt_count: result.attempt_count,
                                    status: 'RETRY_STARTED'
                                }
                                updateCommProcessMessage(whereCond, updateRow, function () {
                                    var topicName = 'FX_COMM_PROCESS_MSG'
                                    var LOG_INFO = { ...objLogInfo };
                                    delete LOG_INFO.headers.LOG_INFO;
                                    delete LOG_INFO.arrConns
                                    delete LOG_INFO.DBSession
                                    delete LOG_INFO.MESSAGE
                                    var topicdata = { DATA: [result], LOG_INFO };
                                    topicdata.ROUTINGKEY = LOG_INFO.ROUTING_KEY
                                    reqProducer.ProduceMessage(topicName, topicdata, strReqHeader, function callback(res) {
                                        _PrintInfo('Inserted the INPUT DATA INTO COMM_PROCESS_MESSAGE TABLE');
                                        return _SendResponse('SUCCESS', '', '', '', '');
                                    });
                                })
                            }
                        }
                    });
                } catch (error) {
                    _PrintError('Error on COMM_PROCESS_MESSAGE ', "ERR-COM-26001", error);
                }
            });
        });
    } catch (error) {
        _PrintError('Error on RetryMessages API', "ERR-COM-26002", error);
        bCompleted = false;
        pRes.send(ex.stack);
    }

    // function InsertComnProcessMessage(InputData, insertCallback) {
    //     try {
    //         //Change the Status value is CREATED and insert into COMM_PROCESS_MESSAGE 
    //         _PrintInfo('BEGIN Insert the INPUT DATA INTO COMM_PROCESS_MESSAGE TABLE');
    //         reqTranDBHelper.InsertTranDBWithAudit(mTranDB, 'COMM_PROCESS_MESSAGE', [InputData], objLogInfo, function callback(pResult, pError) {
    //             if (pError) {
    //                 console.log(pError);
    //             } else {
    //                 // insertCallback();
    //                 InputData.commpm_id = pResult[0].commpm_id;
    //                 var topicName = 'FX_COMM_PROCESS_MSG'
    //                 var LOG_INFO = { ...objLogInfo };
    //                 delete LOG_INFO.headers.LOG_INFO;
    //                 delete LOG_INFO.arrConns
    //                 delete LOG_INFO.DBSession
    //                 delete LOG_INFO.MESSAGE
    //                 var topicdata = { DATA: [InputData], LOG_INFO };
    //                 topicdata.ROUTINGKEY = LOG_INFO.ROUTING_KEY
    //                 reqProducer.ProduceMessage(topicName, topicdata, strReqHeader, function callback(res) {
    //                     _PrintInfo('Inserted the INPUT DATA INTO COMM_PROCESS_MESSAGE TABLE');
    //                     return _SendResponse('SUCCESS', '', '', '', '');
    //                 });
    //             }
    //         });
    //     } catch (error) {
    //         _PrintError('Error on COMM_PROCESS_MESSAGE Insert InsertComnProcessMessage() ', "ERR-COM-26003", error);
    //     }
    // }


    function updateCommProcessMessage(pCond, pUpdateData, pcallback) {
        try {
            _PrintInfo('Updating comm process msg');
            reqTranDBHelper.UpdateTranDBWithAudit(mTranDB, 'COMM_PROCESS_MESSAGE', pUpdateData, pCond, objLogInfo, function (pResult, pError) {
                if (pError) {

                } else {
                    pcallback()
                }
            })
        } catch (error) {

        }
    }
    function _SendResponse(pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
        var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS';
        return reqInstanceHelper.SendResponse('SendMessage', appResponse, pResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning);
    }

    function _PrintError(pMessage, pErrorCode, pError) {
        reqInstanceHelper.PrintError('SendMessage', objLogInfo, pErrorCode, pMessage, pError);
    }

    function _PrintInfo(pMessage) {
        reqInstanceHelper.PrintInfo('SendMessage', pMessage, objLogInfo);
    }

    function _InitializeTrnDB(pHeaders, pCallback) {
        reqTranDBHelper.GetTranDBConn(pHeaders, false, function (pSession) {
            mTranDB = pSession;
            objLogInfo.DBSession = mTranDB;
            pCallback('Success');
        });
    }

});
module.exports = router;