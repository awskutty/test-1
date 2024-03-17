// SendMessage New
// LAST_ERROR_CODE - ERR_SENDMESSAGE_004

var reqExpress = require('express');
var reqAsync = require('async');
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance');
var reqSrvHlpr = require('./ServiceHelper/ServiceHelper');
var reqLogInfo = require('../../../../torus-references/log/trace/LogInfo');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var router = reqExpress.Router();
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqAuditLog = require('../../../../torus-references/log/audit/AuditLog');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqProducer = require('../../../../torus-references/common/Producer');
var serviceName = 'SendMessage';
router.post('/SendMessage', function (appRequest, appResponse) {

    try {

        // Variable declaration
        var strDTCode = 'DEFAULT'; // Will be replaced dynamically, if there is DT_CODE, DTT_CODE comes from the Input params for SendMessage API
        var strDTTCode = 'DEFAULT';
        var strWftpaId = '';
        var strEventCode = '';
        var strAppId = '';
        var strUId = '';
        var strPrctId = '';
        var strUserMail = '';
        var strUserMobile = '';

        var strTemplateCode = '';
        var static_data = '';
        var strClientID = '';
        var strInputParam = appRequest.body.PARAMS;
        var strReqHeader = appRequest.headers;
        var strisArchival = strInputParam.ISARCHIVAL;
        var strarid = strInputParam.AR_ID;
        var ArchivalProcess = strInputParam.PROCESS;
        var kafkaTopicName = strInputParam.TOPIC_NAME
        var KafkMsgFromat = strInputParam.KAFKA_MSG_FORMAT;
        var SchemaId = strInputParam.SCHEMA_ID;
        var SchemaFilePath = strInputParam.SCHEMA_FILE_PATH;
        var strCommGCode = '';
        var strNeedPersistance = '';
        var SkipFlow = false;
        var mTranDB;
        var mDepCas;
        var strATMTDetails = []; // Information about attachment details
        var strTRNData = '';   // Information about transaction details
        // Assign LogInfo detail, event insert 
        console.log("appRequest.headers['session-id'] |" + appRequest.headers['session-id']);
        reqLogInfo.AssignLogInfoDetail(appRequest, function callbackAssignLogInfoDetail(objLogInfo, SessionInfo) {
            _PrintInfo(' Header session id | ' + appRequest.headers['session-id'], objLogInfo);
            _PrintInfo(' objLogInfo TENANT_ID| ' + objLogInfo.TENANT_ID, objLogInfo);
            strInputParam.SessionInfo = SessionInfo;
            SessionInfo.ISARCHIVAL = strisArchival;
            SessionInfo.AR_ID = strarid;
            SessionInfo.ARPROCESS = ArchivalProcess;
            SessionInfo.EXT_TOPIC_NAME = kafkaTopicName;
            SessionInfo.KAFKA_MSG_FORMAT = KafkMsgFromat;
            SessionInfo.SCHEMA_ID = SchemaId;
            SessionInfo.SCHEMA_FILE_PATH = SchemaFilePath;
            SessionInfo.NEED_PERSIST = strNeedPersistance || true;
            objLogInfo.IS_TENANT_MULTI_THREADED = reqInstanceHelper.GetServiceParamsSession({ objLogInfo }).IS_TENANT_MULTI_THREADED;
            objLogInfo.HANDLER_CODE = 'SEND_MESSAGE';
            _PrintInfo('Begin sendMessage', objLogInfo);
            // Initialize required DB
            _InitializeDBConn(objLogInfo, strReqHeader, function callbackInitializeDB(pStatus) {
                _PrintInfo('TranDB initialized successfully', objLogInfo);
                // Prepare the client side params
                _InitializeParams(objLogInfo, strInputParam, SessionInfo, function callbackInitializeParams(pParamStatus) {
                    if (pParamStatus.Status == 'SUCCESS') {
                        _PrintInfo('Params initialized successfully', objLogInfo);
                        //  To Get the new process token id
                        if (!strPrctId) {
                            _GetProcessToken(objLogInfo).then(function (prct_id) {
                                strPrctId = prct_id;
                                commprocess(objLogInfo, SessionInfo);
                            });
                        } else {
                            commprocess(objLogInfo, SessionInfo);
                        }

                    } else {
                        return _SendResponse(objLogInfo, 'FAILURE', pParamStatus.ErrorCode, pParamStatus.ErrorMsg, pParamStatus.Error, pParamStatus.Warning);
                    }
                });
            });
        });

        async function commprocess(objLogInfo, SessionInfo) {
            try {
                objLogInfo.prctid = strPrctId;
                var objValid = await _DoValidation(objLogInfo);
                if (objValid.Status == 'SUCCESS') {
                    //Send message data
                    if (strTRNData == '') { // Without ATMT data
                        _PrintInfo('Continue without  ATMT data null case', objLogInfo);
                        SessionInfo.TRAN_DATA;
                        var arrComPData = [{
                            DT_CODE: strDTCode,
                            DTT_CODE: strDTTCode,
                            WFTPA_ID: strWftpaId,
                            EVENT_CODE: strEventCode,
                            FROM_SCHEDULER: 'N',
                            CREATED_BY: strUId,
                            CREATED_DATE: reqDateFormatter.GetTenantCurrentDateTime(strReqHeader, objLogInfo),
                            PRCT_ID: strPrctId,
                            COMMMG_CODE: strTemplateCode,
                            IS_PROCESSED: 'N',
                            SESSION_INFO: JSON.stringify(SessionInfo),
                            TENANT_ID: objLogInfo.TENANT_ID,
                            ROUTINGKEY: strReqHeader.routingkey
                        }];
                        if (static_data) {
                            arrComPData[0].STATIC_DATA = JSON.stringify(static_data);
                        }
                        _InsertCommProcessdata(objLogInfo, arrComPData, []).then(function (pStatus) {
                            if (pStatus == 'SUCCESS') {
                                if (!strTemplateCode) {
                                    return _SendResponse(objLogInfo, 'FAILURE', 'ERR_SENDMESSAGE_001', 'Communication Category Code is Required...', '', '');
                                } else {
                                    return _SendResponse(objLogInfo, "SUCCESS", '', '', '', '');
                                }
                            } else {
                                return _SendResponse(objLogInfo, 'FAILURE', 'ERR_SENDMESSAGE_002', 'Error occured _InsertCommProcessdata', '', '');
                            }
                        });
                    } else { // With ATMT data
                        _PrintInfo('Continue with ATMT data case', objLogInfo);
                        var arrTRANData = JSON.parse(strTRNData);
                        var arrATMTData = typeof strATMTDetails == 'string' ? JSON.parse(strATMTDetails) : []
                        var DistDTT = [];
                        for (var i = 0; i < arrTRANData.length; i++) {
                            var row = arrTRANData[i];
                            if (DistDTT.indexOf(row['dtt_code']) < 0)
                                DistDTT.push(row['dtt_code']);
                        }
                        _prepareandinsertCommProcessdata(objLogInfo, SessionInfo, arrTRANData, arrATMTData, function callback(pStatus) {
                            return _SendResponse(objLogInfo, pStatus.Status, pStatus.ErrorCode, pStatus.ErrorMsg, pStatus.Error, pStatus.Warning);
                        });
                    }
                } else {
                    return _SendResponse(objLogInfo, objValid.Status, objValid.ErrorCode, objValid.ErrorMsg, objValid.Error, objValid.Warning);
                }
            } catch (error) {
                _PrintError('Error on SendMessage API - GetProcessToken() - catch error', "Error Code", error, objLogInfo);
                return _SendResponse(objLogInfo, 'FAILURE', 'Error Code', 'Error in GetProcessToken()', error, null);
            }
        }

        // Sending message with ATMT data
        function _prepareandinsertCommProcessdata(objLogInfo, SessionInfo, dtTranData, arrATMTData, pCallback) {
            try {
                _PrintInfo('Preparing message template', objLogInfo);
                _prepareCommProcesdata(objLogInfo, SessionInfo, dtTranData, arrATMTData).then(function (res) {
                    _InsertCommProcessdata(objLogInfo, res, arrATMTData).then(function (result) {
                        var resobj = {};
                        if (!strTemplateCode) {
                            resobj.Status = 'FAILURE';
                            resobj.ErrorCode = 'ERR_SENDMESSAGE_003';
                            resobj.ErrorMsg = 'Communication Category Code is Required...';
                        } else {
                            resobj.Status = 'SUCCESS';
                        }
                        pCallback(resobj);
                    }).catch(function (error) {
                        pCallback(preapreFailure(error, 'ERR-COMM-15015', 'Error occured insert comm process datat'));
                    });
                }).catch(function (error) {
                    pCallback(preapreFailure(error, 'ERR-COMM-15016', 'Error occured prepare comm process datat'));
                });

                function preapreFailure(error, errCode, errMsg) {
                    var resobj = {};
                    resobj.Status = 'FAILURE';
                    resobj.ErrorCode = errCode;
                    resobj.ErrorMsg = errMsg;
                    resobj.Error = error;
                    return resobj;
                }

            } catch (error) {
                return _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20004', 'Error on _SendMessageWithATMT()', error, null, pCallback);
            }
        }

        // To find the item id (TRN_ID) from selected tran data
        function _FindItemId(objLogInfo, pRow, pCallback) {
            //Need SKIP this step 
            if (SkipFlow) {
                return pCallback('DEFAULT', 'DEFAULT', 1111);
            }
            var TempDT_CODE = '';
            var TempDTT_CODE = '';
            var TempITEMID = 0;
            try {
                if (pRow['dt_code'] != undefined && pRow['dt_code'] != '')
                    TempDT_CODE = pRow['dt_code'].toString();

                if (!TempDT_CODE) {
                    TempDT_CODE = strDTCode
                }

                if (pRow['dtt_code'] != undefined && pRow['dtt_code'] != '')
                    TempDTT_CODE = pRow['dtt_code'].toString();

                if (!TempDTT_CODE) {
                    TempDTT_CODE = strDTTCode
                }
                if (pRow['TRN_ID']) {
                    TempITEMID = parseInt(pRow['TRN_ID']);
                    _PrintInfo('Item Id found from row - TRN_ID column', objLogInfo);
                    pCallback(TempDT_CODE, TempDTT_CODE, TempITEMID);
                }
                else if (pRow['trn_id']) {
                    TempITEMID = parseInt(pRow['trn_id']);
                    _PrintInfo('Item Id found from row - trn_id column', objLogInfo);
                    pCallback(TempDT_CODE, TempDTT_CODE, TempITEMID);
                } else {
                    _PrintInfo('Trn_id is missing. So getting it from key column', objLogInfo);
                    reqSrvHlpr.GetKeyColumn(mDepCas, strAppId, TempDT_CODE, TempDTT_CODE, objLogInfo, function callbackGetKeyColumn(pDTTDetail) {
                        try {
                            if (pDTTDetail != "FAILURE") {
                                var str = pDTTDetail.split(',');
                                var strKeyclmn = str[1];
                                TempITEMID = pRow[strKeyclmn.toLowerCase()] ? pRow[strKeyclmn.toLowerCase()] : pRow[strKeyclmn.toUpperCase()];
                                pRow['key_column'] = strKeyclmn.toLowerCase();
                                pCallback(TempDT_CODE, TempDTT_CODE, TempITEMID);
                            } else {
                                return _SendResponse(objLogInfo, 'FAILURE', 'ERR-COMM-20025', 'DT and DTT Code Not found', ' Relation Not found', '');
                            }
                        } catch (error) {
                            _PrintError("Error on _FindItemId() ", "ERR-COM-20014", error);
                        }
                    });
                }
            } catch (error) {
                _PrintError("Error on _FindItemId() ", "ERR-COM-20015", error);
            }
        }

        function _prepareCommProcesdata(objLogInfo, SessionInfo, dtTranData, arrATMTData) {
            return new Promise((resolve, reject) => {
                var arrTran = [];
                _PrintInfo('Finding itemId Loop started', objLogInfo);
                reqAsync.forEachSeries(dtTranData, function (drTran, asycallback) {
                    _PrintInfo('Finding itemId from tran data', objLogInfo);
                    _FindItemId(objLogInfo, drTran, function callbackFindItemId(pDTCode, pDTT_CODE, pITEMID) {
                        //  find attachment using tran id if available
                        // var curAtmtDtls = []
                        // if (arrATMTData.length) {
                        //     curAtmtDtls = arrATMTData.filter((value) => {
                        //         return value.trn_id == pITEMID;
                        //     });
                        // }

                        drTran['trn_id'] = pITEMID;
                        SessionInfo.TRAN_DATA = dtTranData;
                        var objTemp = {
                            DT_CODE: pDTCode,
                            DTT_CODE: pDTT_CODE,
                            TRN_ID: pITEMID,
                            WFTPA_ID: strWftpaId,
                            EVENT_CODE: strEventCode,
                            FROM_SCHEDULER: 'N',
                            CREATED_BY: strUId,
                            CREATED_DATE: reqDateFormatter.GetTenantCurrentDateTime(strReqHeader, objLogInfo),
                            PRCT_ID: strPrctId,
                            COMMMG_CODE: strTemplateCode,
                            IS_PROCESSED: 'N',
                            SESSION_INFO: JSON.stringify(SessionInfo),
                            TENANT_ID: objLogInfo.TENANT_ID,
                            ROUTINGKEY: strReqHeader.routingkey,
                            ADDRESSINFO: {
                                TO: drTran.TO,
                                CC: drTran.CC,
                                BCC: drTran.BCC,
                                TO_MOBILE_NO: drTran.MOBILE_NUMBER
                            }
                            // ,ATMT_DETAILS: curAtmtDtls
                        };
                        if (static_data) {
                            objTemp.STATIC_DATA = JSON.stringify(static_data);
                        }
                        arrTran.push(objTemp);
                        asycallback();
                    });
                }, function (error) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(arrTran);
                    }

                });
            });
        }

        function _InsertCommProcessdata(objLogInfo, arrTran, arrATMTData) {
            return new Promise((resolve, reject) => {
                var topicName = 'COMM_PROCESS_DATA';
                var isTenantMultiThreaded = objLogInfo.IS_TENANT_MULTI_THREADED;
                // if (isTenantMultiThreaded) {
                //     _PrintInfo('IS_TENANT_MULTI_THREADED Is Enabled In Redis', objLogInfo);
                //     topicName = topicName + '_' + arrTran[0].ROUTINGKEY;
                // } else {
                //     _PrintError('IS_TENANT_MULTI_THREADED Is Not Enabled In Redis, So Going With Default Topic Name', 'ERR_SENDMESSAGE_004', '', objLogInfo);
                // }
                // topicName = topicName.replace(/~/g, '_').toUpperCase(); // If Replace is Not Done then It will not create a Kfka Topic
                _PrintInfo('Kafka Topic Name - ' + topicName, objLogInfo);
                // Insert data into kafka tpoic 
                var LOG_INFO = { ...objLogInfo };
                if (LOG_INFO && LOG_INFO.headers && LOG_INFO.headers.LOG_INFO) {
                    delete LOG_INFO.headers.LOG_INFO;
                }
                delete LOG_INFO.MESSAGE;
                var data = {
                    TRAN_DETAILS: arrTran,
                    ATMT_DETAILS: arrATMTData
                }
                var topicdata = { DATA: data, LOG_INFO };
                reqProducer.ProduceMessage(topicName, topicdata, strReqHeader, function caalback(res) {
                    resolve(res);
                });
            });
        }

        function checkCommGroupavailable(objLogInfo) {
            return new Promise((resolve, reject) => {
                var strQuery = `SELECT * FROM COMM_INFO WHERE COMMMG_CODE='${strTemplateCode}' AND APP_ID='${objLogInfo.APP_ID}'`
                reqFXDBInstance.GetFXDBConnection(strReqHeader, 'dep_cas', objLogInfo, function (dbsession) {
                    reqFXDBInstance.ExecuteQuery(dbsession, strQuery, objLogInfo, function (pError, pResult) {
                        if (pError) {
                            return _PrepareCallbackObject('FAILURE', null, 'ERR-COM-20009', '', null, 'Error:COMMMG_CODE field is missing');
                        }
                        else {
                            if (pResult.rows.length > 0) {
                                resolve("SUCCESS")
                            } else {
                                resolve("Template not found")
                            }
                        }
                    })
                });
            })
        }

        // Print info 
        function _PrintInfo(pMessage, objLogInfo) {
            reqInstanceHelper.PrintInfo('SendMessage', pMessage, objLogInfo);
        }

        // Print error 
        function _PrintError(pMessage, pErrorCode, pError, objLogInfo) {
            reqInstanceHelper.PrintError('SendMessage', objLogInfo, pErrorCode, pMessage, pError);
        }

        // Initialize database connection
        function _InitializeDBConn(objLogInfo, pHeaders, pCallback) {
            reqFXDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function CallbackGetCassandraConn(pClient) {
                mDepCas = pClient;
                reqTranDBHelper.GetTranDBConn(pHeaders, false, function (pSession) {
                    mTranDB = pSession;
                    pCallback('Success');
                });
            });
        }


        // Do input validation
        async function _DoValidation(objLogInfo) {
            if (strDTCode == '') {
                return _PrepareCallbackObject('FAILURE', null, 'ERR-COM-20005', '', null, 'Error:DT_CODE field is missing');
            }
            if (strDTTCode == '') {
                return _PrepareCallbackObject('FAILURE', null, 'ERR-COM-20006', '', null, 'Error:DTT_CODE field is missing');
            }
            if (strWftpaId == '') {
                return _PrepareCallbackObject('FAILURE', null, 'ERR-COM-20007', '', null, 'Error:WFTPA_ID field is missing');
            }
            if (strEventCode == '') {
                return _PrepareCallbackObject('FAILURE', null, 'ERR-COM-20008', '', null, 'Error:EVENT_CODE field is missing');
            }
            if (strTemplateCode) {
                var res = await checkCommGroupavailable(objLogInfo)
                if (res != "SUCCESS") {
                    return _PrepareCallbackObject('FAILURE', null, 'ERR-COM-20018', '', null, 'Requested template not found');
                } else {
                    return _PrepareCallbackObject('SUCCESS', null, '', '', null, null);
                }
            } else {
                return _PrepareCallbackObject('FAILURE', null, 'ERR-COM-20028', '', null, 'Template is empty in request');
            }

        }

        // Prepare callback object
        function _PrepareCallbackObject(pStatus, pData, pErrorCode, pErrMsg, pError, pWarning) {
            var pCallbackObj = {
                Status: pStatus,
                Data: pData,
                ErrorCode: pErrorCode,
                ErrorMsg: pErrMsg,
                Error: pError,
                Warning: pWarning
            };
            return pCallbackObj;
        }


        // Initialize Client Params
        function _InitializeParams(objLogInfo, pClientParam, SessionInfo, pCallback) {
            try {
                // Initialize client params 
                if (pClientParam['SESSION_ID'] != undefined && pClientParam['SESSION_ID'] != '')
                    strSessionID = pClientParam['SESSION_ID'].toString();

                if (pClientParam['WFTPA_ID'] != undefined && pClientParam['WFTPA_ID'] != '')
                    strWftpaId = pClientParam['WFTPA_ID'].toString();
                objLogInfo.wftpaid = strWftpaId;

                if (pClientParam['DT_CODE'] != undefined && pClientParam['DT_CODE'] != '')
                    strDTCode = pClientParam['DT_CODE'].toString();

                if (pClientParam['DTT_CODE'] != undefined && pClientParam['DTT_CODE'] != '')
                    strDTTCode = pClientParam['DTT_CODE'].toString();

                if (pClientParam['EVENT_CODE'] != undefined && pClientParam['EVENT_CODE'] != '')
                    strEventCode = pClientParam['EVENT_CODE'].toString();

                if (pClientParam['PRCT_ID'] != undefined && pClientParam['PRCT_ID'] != '')
                    strPrctId = pClientParam['PRCT_ID'].toString();

                if (pClientParam['USER_EMAIL'] != undefined && pClientParam['USER_EMAIL'] != '')
                    strUserMail = pClientParam['USER_EMAIL'].toString();

                if (pClientParam['USER_MOBILE'] != undefined && pClientParam['USER_MOBILE'] != '')
                    strUserMobile = pClientParam['USER_MOBILE'].toString();

                if (pClientParam['ATMT_DATA'] != undefined && pClientParam['ATMT_DATA'] != '')
                    strTRNData = pClientParam['ATMT_DATA'].toString();


                if (pClientParam['ATMT_DETAILS'] != undefined && pClientParam['ATMT_DETAILS'] != '')
                    strATMTDetails = pClientParam['ATMT_DETAILS'].toString();

                if (pClientParam['TRN_DETAILS'] != undefined && pClientParam['TRN_DETAILS'] != '')
                    strTRNData = pClientParam['TRN_DETAILS'].toString();

                // TEMPLATECODE --> Communication group code
                if (pClientParam['TEMPLATECODE'] != undefined && pClientParam['TEMPLATECODE'] != '')
                    strTemplateCode = pClientParam['TEMPLATECODE'].toString();

                // Getting Static Data
                if (pClientParam.STATIC_DATA) {
                    static_data = pClientParam['STATIC_DATA'];
                }
                SkipFlow = pClientParam['SKIP_COMM_FLOW'];

                // Initialize session level params
                var Params = SessionInfo;
                if (Params['U_ID'] != undefined && Params['U_ID'] != '')
                    strUId = Params['U_ID'];

                if (Params['APP_ID'] != undefined && Params['APP_ID'] != '')
                    strAppId = Params['APP_ID'];

                if (Params['CLIENT_ID'] != undefined && Params['CLIENT_ID'] != '')
                    strClientID = Params['CLIENT_ID'].toString();

                if (Params['COMMM_CODE'] != undefined && Params['COMMM_CODE'] != '')
                    strCommGCode = Params['COMMM_CODE'].toString();

                strNeedPersistance = pClientParam.NeedPersist;
                return _PrepareAndSendCallback('SUCCESS', null, null, null, null, null, pCallback);

            } catch (error) {
                return _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20020', 'Error on _InitializeParams() function ', error, null, pCallback);
            }
        }

        function _GetProcessToken(objLogInfo) {
            return new Promise((resolve, reject) => {
                reqAuditLog.GetProcessToken(mTranDB, objLogInfo, function (err, prct_id) {
                    if (err) {
                        reject();
                    } else {
                        resolve(prct_id);
                    }
                });
            });
        }

        // Send response
        function _SendResponse(objLogInfo, pResponseData, pErrorCode, pErrorMsg, pError, pWarning) {
            var strProcessStatus = (pWarning != null && pWarning != '') ? 'FAILURE' : 'SUCCESS';
            return reqInstanceHelper.SendResponse(serviceName, appResponse, pResponseData, objLogInfo, pErrorCode, pErrorMsg, pError, strProcessStatus, pWarning);
        }

        // Prepare callback object
        function _PrepareAndSendCallback(pStatus, pData, pErrorCode, pErrMsg, pError, pWarning, pCallback) {
            pCallbackObj = {
                Status: pStatus,
                Data: pData,
                ErrorCode: pErrorCode,
                ErrorMsg: pErrMsg,
                Error: pError,
                Warning: pWarning
            };
            return pCallback(pCallbackObj);
        }

    } catch (error) {
        return _SendResponse({}, _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20025', 'Exception occured  ', error, null, ''));
    }

});

module.exports = router;
