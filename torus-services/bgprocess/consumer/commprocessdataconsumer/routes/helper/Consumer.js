/****
  Descriptions - To consume TRAN_DATA topic to prepare auditing data in solr  
  @Last_Error_Code              : ERR-ATMT-CONSUMER-0002
 ****/

// Require dependencies
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');
var logFilePath = 'bgprocess/consumer/CommunicationprocessdataConsumer';
var objLogInfo = reqLogWriter.GetLogInfo('CommunicationConsumer', logFilePath);
var reqFXDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqTranDBHelper = require('../../../../../torus-references/instance/TranDBInstance');
var reqComm = require('../../../../../torus-references/communication/core/SendMessage');
var reqDateFormatter = require('../../../../../torus-references/common/dateconverter/DateFormatter');
var reqProducer = require('../../../../../torus-references/common/Producer');
var reqSrvHlpr = require('../helper/ServiceHelper');
var reqAsync = require('async');
var uuid = require('node-uuid');

// Starting consumer for topic TRAN_DATA
function startConsuming(pConsumerName, pTopic, pConsumer, pKafka) {
    try {
        reqInstanceHelper.PrintInfo(pConsumerName, 'Started consuming', objLogInfo);
        reqLogWriter.EventUpdate(objLogInfo);
        var mOrm = 'knex';

        var strMsg = '';
        var headers = {
            routingkey: 'TRANDB~CLT-0~APP-0~TNT-0~ENV-0'
        };

        var strRoutingKey = 'CLT-1408~APP-3~TNT-0~ENV-DEV';
        var pHeaders = {
            routingkey: strRoutingKey
        };
        var producerInfo = {};
        producerInfo.producerInstance = pKafka.Producer;
        pConsumer.on('message', function (message) {
            setTimeout(() => {
                pConsumer.commit(true, function (error, result) {
                    var rows = JSON.parse(message.value);
                    var NeedPresist = true;
                    if (rows[0].SESSION_INFO) {
                        var parsedData = JSON.parse(rows[0].SESSION_INFO);
                        strRoutingKey = parsedData.ROUTINGKEY;
                        NeedPresist = parsedData.NEED_PERSIST;
                    }
                    pHeaders = {
                        routingkey: strRoutingKey
                    };
                    mainfunction(rows, NeedPresist);
                }, 0);
            });
        });


        function mainfunction(arrTran, NeedPresist) {
            reqFXDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function (cltSession) {
                reqFXDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function (depSession) {
                    reqFXDBInstance.GetFXDBConnection(pHeaders, 'res_cas', objLogInfo, function (resSession) {
                        reqTranDBHelper.GetTranDBConn(pHeaders, false, function (TranDbsession) {

                            function _insertCommPrcessData(arrTran, callbackfunction) {
                                try {
                                    reqTranDBHelper.InsertTranDB(TranDbsession, 'COMM_PROCESS_DATA', arrTran, objLogInfo, function callbackInsertCommProcessData(pResult, pError) {
                                        if (pError) {
                                            _PrintInfo('Error occured while insert comm process data.' + pError, objLogInfo);
                                        } else {
                                            callbackfunction(arrTran);
                                        }
                                    });
                                } catch (error) {
                                    _PrintInfo('Exception occured while insert comm process data.' + error, objLogInfo);
                                }
                            }



                            if (NeedPresist) {
                                _insertCommPrcessData(arrTran, prepareMessage);
                            } else {
                                prepareMessage(arrTran);
                            }


                            function prepareMessage(Res) {
                                try {
                                    if (Res[0].SESSION_INFO) {
                                        var sessioninfo = JSON.parse(Res[0].SESSION_INFO);
                                        sessioninfo.event_code = Res[0].EVENT_CODE;
                                        sessioninfo.wftpa_id = Res[0].WFTPA_ID;
                                        sessioninfo.dt_code = Res[0].DT_CODE;
                                        sessioninfo.dtt_code = Res[0].DTT_CODE;

                                        //  Process Modeller setup
                                        var whereCond = {};
                                        whereCond.commmg_code = Res[0].COMMMG_CODE;
                                        whereCond.wftpa_id = Res[0].WFTPA_ID;
                                        whereCond.event_code = Res[0].EVENT_CODE;
                                        whereCond.app_id = sessioninfo.APP_ID;
                                        var staticCommProcessData = Res[0].STATIC_DATA;
                                        var PrctId = Res[0].PRCT_ID;
                                        sessioninfo.staticCommProcessData = staticCommProcessData;
                                        getcommTemplateDeatil(whereCond).then((template) => {
                                            if (template.length) {
                                                gettranquerydetail(PrctId, template, sessioninfo);
                                            } else {

                                                _PrintInfo('Template Not available with event code wftpa id, check with DEFAULT .', objLogInfo);
                                                // UI Modeller Get data from COMM_INFO table with wftpa_id dt, dtt event code as "DEFAULT" 
                                                var defaultWhereCOnd = {};
                                                defaultWhereCOnd.commmg_code = Res[0].COMMMG_CODE;
                                                defaultWhereCOnd.wftpa_id = "DEFAULT";
                                                defaultWhereCOnd.event_code = "DEFAULT";
                                                defaultWhereCOnd.dt_code = "DEFAULT";
                                                defaultWhereCOnd.dtt_code = "DEFAULT";
                                                defaultWhereCOnd.app_id = '0';
                                                getcommTemplateDeatil(defaultWhereCOnd).then((defaultTemplate) => {
                                                    if (defaultTemplate.length) {
                                                        gettranquerydetail(PrctId, defaultTemplate, sessioninfo);
                                                    } else {
                                                        _PrintInfo('Template Not available.' + Res[0].COMMMG_CODE, objLogInfo);

                                                        //  Marked the comm process data as processed 
                                                        var updaterow = {};
                                                        updaterow.is_processed = 'Y';
                                                        updaterow.comments = 'Template Not available';
                                                        var updatecond = {};
                                                        updatecond.prct_id = prctid;
                                                        updatecond.commmg_code = Res[0].commmg_code;
                                                        updatetable('COMM_PROCESS_DATA', updaterow, updareCond, objLogInfo).then(function () {
                                                            console.log('COMM_PROCESS_DATA updated successfully');
                                                        });
                                                    }
                                                }).catch((error) => {
                                                    _PrintInfo('Exception occured getcommTemplateDeatil | 2 ' + error, objLogInfo);
                                                });
                                            }
                                        }).catch((error) => {
                                            console.log(error);
                                            var updareRow = {
                                                is_processed: 'Y',
                                                comments: error
                                            };
                                            var updareCond = {
                                                prct_id: prctid,
                                            };

                                            _PrintInfo('Exception occured getcommTemplateDeatil | 1 ' + error, objLogInfo); s;

                                            updatetable('COMM_PROCESS_DATA', updareRow, updareCond, objLogInfo).then(function () {
                                                _PrintInfo('COMM_PROCESS_DATA updated successfully', objLogInfo);
                                            });
                                        });

                                    } else {
                                        var updareRow = {
                                            is_processed: 'Y',
                                            comments: "SESSION_INFO column is null.It required to create comm_process_messag data"
                                        };
                                        var updareCond = {
                                            prct_id: Res[0].PRCT_ID
                                        };
                                        updatetable('COMM_PROCESS_DATA', updareRow, updareCond, objLogInfo).then(function () {
                                            _PrintInfo('COMM_PROCESS_DATA updated successfully', objLogInfo);
                                        });
                                    }
                                } catch (error) {
                                    var updareRow = {
                                        is_processed: 'Y',
                                        comments: error
                                    };
                                    var updareCond = {
                                        prct_id: Res[0].PRCT_ID
                                    };
                                    updatetable('COMM_PROCESS_DATA', updareRow, updareCond, objLogInfo).then(function () {
                                        _PrintInfo('COMM_PROCESS_DATA updated successfully', objLogInfo);
                                    });
                                }
                            }

                            function gettranquerydetail(prctid, ptemplates, sessInfo) {
                                try {
                                    _PrintInfo('Getting trn and trna data from comm info table ', objLogInfo);
                                    reqAsync.forEachOfSeries(ptemplates, function (pTemplt, idx, pCallback) {
                                        var strData = [];
                                        reqAsync.parallel({
                                            TRN_QUERY: function (parCB) {
                                                // Get Trn details  
                                                reqSrvHlpr.GetTRNDetails(TranDbsession, mOrm, depSession, pTemplt.trn_qry, sessInfo.APP_ID, sessInfo.dt_code, sessInfo.dtt_code, pTemplt.wftpa_id, sessInfo.U_ID, prctid, objLogInfo, pTemplt, sessInfo, function callback(pResult, pTemplt, pStatusObj) {
                                                    if (pStatusObj.Status == 'SUCCESS') {
                                                        if (pResult)
                                                            strData = pResult.rows;
                                                        // For delete case no rows will be return on query - In that case assign input data

                                                        // Need to verify 
                                                        // Get User mailID / MobileNo from FX DB (USERS table)
                                                        var type = JSON.parse(pTemplt.category_info).COMMC_CONFIG.CONFIG.TYPE;
                                                        var ContactInfo = JSON.parse(pTemplt.contact_info);
                                                        reqSrvHlpr.GetEmailIDFromFXDB(cltSession, strData, ContactInfo, sessInfo.APP_ID, sessInfo.CLIENT_ID, type, objLogInfo, function callbackGetEmailIDfromFXDB(pData, pContacts, pStatusObj) {
                                                            pTemplt.CONTACT_INFOs = pContacts;
                                                            parCB(null, pData, pTemplt, pStatusObj);
                                                        });
                                                    } else {
                                                        parCB(null, strData, pTemplt, pStatusObj);
                                                    }
                                                });
                                            },
                                            TRNA_QUERY: function (parCB) {
                                                // Get Attachments                                    
                                                reqSrvHlpr.GetAttachments(TranDbsession, resSession, depSession, pTemplt.trna_qry, pTemplt.commmt_code, sessInfo.APP_ID, sessInfo.dt_code, sessInfo.dtt_code, pTemplt.wftpa_id, sessInfo.U_ID, prctid, sessInfo.TRAN_DATA, objLogInfo, function callback(pATTObject) {
                                                    var arrATT = [];
                                                    if (pATTObject.Status == 'SUCCESS') {
                                                        arrATT = pATTObject.Data.rows;
                                                    }
                                                    parCB(null, arrATT, pATTObject);
                                                });
                                            }
                                        }, function (err, result) {
                                            try {
                                                if (result.TRN_QUERY[2].Status == 'SUCCESS') { // If TRN_QRY query fails
                                                    // if BOTH are Success
                                                    strData = result.TRN_QUERY[0];
                                                    _PrintInfo('------------- Template TRN Query - ' + pTemplt.trn_qry + ' -------------', objLogInfo);
                                                    _PrintInfo('------------- Template Group Code - ' + pTemplt.commmg_code + ' Template Code - ' + pTemplt.commmt_code + ' -------------', objLogInfo);
                                                    _PrintInfo('------------- TRN Query Result Count - ' + strData.length + ' -------------', objLogInfo);
                                                    var template = result.TRN_QUERY[1];
                                                    template.TEMPLATE_INFO = JSON.parse(template.template_info);
                                                    template.CATEGORY_INFO = JSON.parse(template.category_info);
                                                    // template.ATTACHMENTs = result.TRNA_QUERY[0];
                                                    var atmtInfo = {};
                                                    atmtInfo.DYNAMICATMT = false;
                                                    if (result.TRNA_QUERY[0] && result.TRNA_QUERY[0].length) {
                                                        var atmtRes = result.TRNA_QUERY[0];
                                                        atmtInfo.DYNAMICATMT = true;
                                                        atmtInfo.DYNAMICATMTDATA = atmtRes;
                                                    }
                                                    template.ATMTINFOS = atmtInfo;
                                                    if (template.comm_type.toUpperCase() == 'MAIL') {
                                                        preparemailcomminsert(template, strData, prctid, sessInfo, objLogInfo).then(function () {
                                                            //  Marked the comm process data as processed 
                                                            pCallback();
                                                        }).catch((err) => {
                                                            _PrintInfo('preparemailcomminsert err' + err, objLogInfo);
                                                            // Need to update  status
                                                            pCallback();
                                                        });
                                                    } else if (template.comm_type.toUpperCase() == 'SMS') {
                                                        preparesmscomminsert(template, strData, prctid, sessInfo, objLogInfo).then(function () {
                                                            pCallback();
                                                        });
                                                    }
                                                } else {
                                                    pCallback();
                                                }
                                            } catch (error) {
                                                _PrintInfo('reqAsync.parallel final callback err' + error, objLogInfo);
                                            }
                                        });
                                    }, function (error) {
                                        var updareRow = {
                                            is_processed: 'Y',
                                        };
                                        if (error) {
                                            updareRow.comments = error;
                                        }
                                        var updareCond = {
                                            prct_id: prctid,
                                        };
                                        updatetable('COMM_PROCESS_DATA', updareRow, updareCond, objLogInfo).then(function () {
                                            console.log('COMM_PROCESS_DATA updated successfully');
                                        });

                                    });
                                } catch (error) {
                                    _PrintInfo('Exception occured updatetable ' + error, objLogInfo);
                                    var updareRow = {
                                        is_processed: 'Y',
                                        comments: error
                                    };
                                    var updareCond = {
                                        prct_id: prctid
                                    };
                                    updatetable('COMM_PROCESS_DATA', updareRow, updareCond, objLogInfo).then(function () {

                                    });
                                }
                            }

                            //  Get Comm template detail
                            function getcommTemplateDeatil(whereCond) {
                                try {
                                    return new Promise(function (resolve, reject) {
                                        // Find the template code from comm info table
                                        _PrintInfo('Getting communication template from comm info table', objLogInfo);
                                        reqFXDBInstance.GetTableFromFXDB(depSession, 'COMM_INFO', [], whereCond, objLogInfo, function (pErr, pRes) {
                                            if (pErr) {
                                                reject(pErr);
                                            } else {
                                                resolve(pRes.rows);
                                            }
                                        });
                                    });
                                } catch (error) {
                                    _PrintInfo('Exception occured updatetable ' + error, objLogInfo);
                                }
                            }


                            // To prepare the mail message for sending mail
                            function preparemailcomminsert(pTemplate, pData, prctid, psessInfo, pLogInfo) {
                                _PrintInfo('Prepare mail object ', objLogInfo);
                                return new Promise((resolve, reject) => {
                                    try {
                                        var ObjAdress = {};
                                        var mailstatus = "";
                                        _PrintInfo('Mail prepare for comm mode | ' + pTemplate.TEMPLATE_INFO.COMMMT_MODE, objLogInfo);
                                        var insertarr = [];
                                        if (pData.length) {
                                            reqAsync.forEachOfSeries(pData, function (row, indx, mailcallback) {
                                                var insertObj = {};
                                                if (pTemplate.TEMPLATE_INFO.COMMMT_MODE.toUpperCase() == 'INDIVIDUAL') {
                                                    insertObj = prepareMailMesg(pTemplate, row, 'Individual', prctid, pLogInfo, psessInfo);
                                                } else {
                                                    _PrintInfo('Communication MODE is GROUP', pLogInfo);
                                                    insertObj = prepareMailMesg(pTemplate, row, 'Group', prctid, pLogInfo, psessInfo);
                                                }
                                                insertarr.push(insertObj);
                                                mailcallback();
                                            }, function (error) {
                                                if (error) {
                                                    _PrintInfo('Error occured _MailPreparation function ' + error, pLogInfo);
                                                    resolve(error);
                                                } else {
                                                    _PrintInfo('reqAsync.forEachSeries success ' + mailstatus, pLogInfo);
                                                    CommProcessMsgInsert(insertarr, function () {
                                                        resolve();
                                                    });
                                                }
                                            });
                                        } else {
                                            var insertObj = {};

                                            if (pTemplate.TEMPLATE_INFO.COMMMT_MODE.toUpperCase() == 'INDIVIDUAL') {
                                                insertObj = prepareMailMesg(pTemplate, [], 'Individual', prctid, pLogInfo, psessInfo);
                                            } else {
                                                _PrintInfo('Communication MODE is GROUP', pLogInfo);
                                                insertObj = prepareMailMesg(pTemplate, [], 'Group', prctid, pLogInfo, psessInfo);
                                            }
                                            insertarr.push(insertObj);
                                            CommProcessMsgInsert(insertarr, function () {
                                                resolve();
                                            });
                                        }

                                    } catch (ex) {
                                        _PrintInfo('Exception occured ' + ex, objLogInfo);

                                        var updaterow = {};
                                        updaterow.is_processed = 'Y';
                                        updaterow.comments = JSON.stringify(ex);
                                        var updatecond = {};
                                        updatecond.prct_id = prctid;
                                        updatetable('COMM_PROCESS_DATA', updaterow, updatecond, objLogInfo).then(function (updateRes) {
                                            _PrintInfo('COMM_PROCESS_DATA processed successfully', objLogInfo);
                                            resolve(ex);
                                        }).catch(function (error) {
                                            _PrintInfo('Error occured while update comm process data table' + error, objLogInfo);
                                        });

                                    }
                                });
                            }


                            function prepareMailMesg(pTemplate, row, typeofmethod, prctid, pLogInfo, psessInfo) {
                                try {

                                    var strTemp_info = JSON.parse(pTemplate.TEMPLATE_INFO.TEMP_INFO);
                                    // Individual
                                    var ObjAdress = {};
                                    ObjAdress.IsBodyHtml = true; //Attachment
                                    // PREPARE TO ADDRESS
                                    var Toaddr = [];
                                    var Ccaddr = [];
                                    var Bccaddr = [];
                                    for (var i = 0; i < pTemplate.CONTACT_INFOs.length; i++) {
                                        var addr = pTemplate.CONTACT_INFOs[i];
                                        // TO
                                        var functionName = reqComm['GetDestAddress' + typeofmethod];

                                        if (addr.ADDRESS_TYPE.toUpperCase() === 'TO')
                                            Toaddr.push(functionName(addr, row));
                                        // CC
                                        if (addr.ADDRESS_TYPE.toUpperCase() === 'CC')
                                            Ccaddr.push(functionName(addr, row));
                                        // BCC
                                        if (addr.ADDRESS_TYPE.toUpperCase() === 'BCC')
                                            Bccaddr.push(functionName(addr, row));
                                    }

                                    // TO
                                    if (Toaddr.length > 0)
                                        ObjAdress.To = Toaddr.join();

                                    // CC
                                    if (Ccaddr.length > 0)
                                        ObjAdress.Cc = Ccaddr.join();

                                    // BCC
                                    if (Bccaddr.length > 0)
                                        ObjAdress.Bcc = Bccaddr.join();

                                    var strMsg = pTemplate.TEMPLATE_INFO.COMMMT_MESSAGE.toString();
                                    var strSubject = pTemplate.TEMPLATE_INFO.COMMMT_SUBJECT.toString();
                                    strMsg = reqComm.PrepareMessage(strMsg, null, row, pLogInfo);
                                    strSubject = reqComm.PrepareMessage(strSubject, null, row, pLogInfo);
                                    var Mailinfo = {};
                                    Mailinfo.Message = strMsg;
                                    Mailinfo.Subject = strSubject;
                                    Mailinfo.Address = ObjAdress;
                                    Mailinfo.sessInfo = psessInfo;
                                    Mailinfo.ATTACHMENTINFOS = pTemplate.ATMTINFOS;
                                    Mailinfo.SCHEDULE = {
                                        "PRIORITY": strTemp_info.PRIORITY,
                                        "RETRY_COUNT": strTemp_info.RETRY_COUNT,
                                        "RETRY_INTERVAL": strTemp_info.RETRY_INTERVAL,
                                        "SCOPES": strTemp_info.SCOPES,
                                        "CONFIG_SETUP": strTemp_info.CONFIGSETUP
                                    };
                                    // insert object for comm process message
                                    var insertObj = {};
                                    insertObj.message = JSON.stringify(Mailinfo);
                                    insertObj.type = 'MAIL';
                                    insertObj.created_date = reqDateFormatter.GetCurrentDate(pHeaders);
                                    insertObj.prct_id = prctid;
                                    insertObj.wftpa_id = psessInfo.wftpa_id;
                                    insertObj.event_code = psessInfo.event_code;
                                    insertObj.trn_id = row.trn_id;
                                    insertObj.status = 'CREATED';
                                    insertObj.created_by = psessInfo.U_ID;
                                    insertObj.attempt_count = 1;
                                    insertObj.commmt_code = pTemplate.commmt_code;
                                    insertObj.comm_msg_id = uuid.v1();
                                    return insertObj;
                                } catch (error) {
                                    console.log(error);
                                }

                            }


                            function prepareSMSMesg(pTemplate, row, prctid, pLogInfo, psessInfo) {
                                var strTemp_info = JSON.parse(pTemplate.TEMPLATE_INFO.TEMP_INFO);
                                var ObjMessage = {};
                                var functionName = '';

                                if (pTemplate.TEMPLATE_INFO.COMMMT_MODE.toUpperCase() == 'INDIVIDUAL') {
                                    functionName = reqComm['GetDestAddressIndividual'];
                                } else {
                                    functionName = reqComm['GetDestAddressGroup'];
                                }
                                var strMsg = pTemplate.TEMPLATE_INFO.COMMMT_MESSAGE;
                                strMsg = reqComm.PrepareMessage(strMsg, null, row);
                                ObjMessage.Message = strMsg;

                                // Prepare TO Address
                                var Toaddr = [];

                                for (var j = 0; j < pTemplate.CONTACT_INFOs.length; j++) {
                                    var addr = pTemplate.CONTACT_INFOs[j];
                                    // TO
                                    if (addr.ADDRESS_TYPE.toUpperCase() === 'TO')
                                        Toaddr.push(functionName(addr, row));
                                }
                                if (Toaddr.length == 0) {
                                    _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20067', '', null, 'Destination not Available', callback);
                                } else {
                                    ObjMessage.To = Toaddr.join();
                                    ObjMessage.sessInfo = psessInfo;
                                    ObjMessage.SCHEDULE = {
                                        "PRIORITY": strTemp_info.PRIORITY,
                                        "RETRY_COUNT": strTemp_info.RETRY_COUNT,
                                        "RETRY_INTERVAL": strTemp_info.RETRY_INTERVAL,
                                        "SCOPES": strTemp_info.SCOPES,
                                        "CONFIG_SETUP": strTemp_info.CONFIGSETUP
                                    };
                                    var insertObj = {};
                                    insertObj.message = JSON.stringify(ObjMessage);
                                    insertObj.type = 'SMS';
                                    insertObj.created_date = reqDateFormatter.GetCurrentDate(pHeaders);
                                    insertObj.prct_id = prctid;
                                    insertObj.wftpa_id = psessInfo.wftpa_id;
                                    insertObj.event_code = psessInfo.event_code;
                                    insertObj.trn_id = row.trn_id;
                                    insertObj.status = 'CREATED';
                                    insertObj.created_by = psessInfo.U_ID;
                                    insertObj.attempt_count = 1;
                                    insertObj.commmt_code = pTemplate.commmt_code;
                                    insertObj.comm_msg_id = uuid.v1();

                                    return insertObj;
                                }
                            }


                            function CommProcessMsgInsert(insertarr, callback) {
                                if (NeedPresist) {
                                    _PrintInfo('COMM_PROCESS_MESSAGE insert started', objLogInfo);
                                    inserttable('COMM_PROCESS_MESSAGE', insertarr, objLogInfo).then(function (commsgid) {
                                        _PrintInfo('COMM_PROCESS_MESSAGE insert Success', objLogInfo);
                                        reqProducer.ProduceMessage('FX_COMM_PROCESS_MSG', insertarr, pHeaders, function caalback(res) {
                                            callback();
                                        });
                                    }).catch(function (error) {
                                        _PrintInfo('Error occured inserttable MAIL COMM_PROCESS_MESSAGE' + error, objLogInfo);
                                        var updaterow = {};
                                        updaterow.is_processed = 'Y';
                                        updaterow.comments = JSON.stringify(error);
                                        var updatecond = {};
                                        updatecond.prct_id = prctid;
                                        updatetable('COMM_PROCESS_DATA', updaterow, updatecond, objLogInfo).then(function (updateRes) {
                                            _PrintInfo('COMM_PROCESS_DATA processed successfully', objLogInfo);
                                        }).catch(function (error) {
                                            _PrintInfo('Error occured while update comm process data table' + error, objLogInfo);
                                        });
                                    });
                                } else {
                                    reqProducer.ProduceMessage('FX_COMM_PROCESS_MSG', insertarr, pHeaders, function caalback(res) {
                                        callback();
                                    });
                                }
                            }
                            // To prepare message and Send SMS
                            function preparesmscomminsert(pTemplate, pData, prctid, psessInfo, pLogInfo) {
                                return new Promise((ResolveRes, rejecterr) => {
                                    var ObjMessage = {};
                                    try {
                                        _PrintInfo('Prepare sms comm mode is | ' + pTemplate.TEMPLATE_INFO.COMMMT_MODE, objLogInfo);
                                        var strTemp_info = JSON.parse(pTemplate.TEMPLATE_INFO.TEMP_INFO);
                                        var insertarr = [];
                                        if (pData.length) {
                                            reqAsync.forEachOfSeries(pData, function (row, index, smscallback) {
                                                var Insertobj = prepareSMSMesg(pTemplate, pData, prctid, pLogInfo, psessInfo);
                                                insertarr.push(Insertobj);
                                                smscallback();
                                            }, function (error) {
                                                if (error) {
                                                    _PrintInfo('Exception occured forEachOfSeries final callback ' + error, objLogInfo);
                                                } else {
                                                    CommProcessMsgInsert(insertarr, function () {
                                                        ResolveRes();
                                                    });
                                                }
                                            });
                                        } else {
                                            var Insertobj = prepareSMSMesg(pTemplate, pData, prctid, pLogInfo, psessInfo);
                                            insertarr.push(Insertobj);
                                            CommProcessMsgInsert(insertarr, function () {
                                                ResolveRes();
                                            });
                                        }

                                    } catch (error) {
                                        _PrintInfo('Exception occured preparesmscomminsert ' + error, objLogInfo);
                                    }
                                });
                            }

                            // inert the data into tran DB 
                            function inserttable(ptargettbale, insertRows, pLogInfo) {
                                return new Promise((resolve, reject) => {
                                    try {
                                        _PrintInfo('insert started for table ' + ptargettbale);
                                        reqTranDBHelper.InsertTranDB(TranDbsession, ptargettbale, insertRows, pLogInfo, function (InsertRes, insertErr) {
                                            if (insertErr) {
                                                reject(insertErr);
                                            } else {
                                                try {
                                                    _PrintInfo('insert success');
                                                    var commsgid = InsertRes[0].commpm_id;
                                                    resolve(commsgid);
                                                } catch (error) {
                                                    console.log('error ' + error);
                                                    reject(insertErr);
                                                }

                                            }
                                        });
                                    } catch (error) {
                                        _PrintInfo('Exception occured inserttable ' + error, objLogInfo);
                                        reject(error);
                                    }
                                });
                            }

                            function updatetable(ptargettbale, updaterow, updatecond, pLogInfo) {
                                return new Promise((resolve, reject) => {
                                    try {
                                        reqTranDBHelper.UpdateTranDB(TranDbsession, ptargettbale, updaterow, updatecond, pLogInfo, function (updateRes, UpdateErr) {
                                            if (UpdateErr) {
                                                reject(UpdateErr);
                                            } else {
                                                resolve();
                                            }
                                        });
                                    } catch (error) {
                                        _PrintInfo('Exception occured updatetable ' + error, objLogInfo);
                                        reject(error);
                                    }
                                });
                            }
                        });
                    });
                });
            });
        }



        function _PrintInfo(pMessage, pLogInfo) {
            reqInstanceHelper.PrintInfo('CommunicationConsumer', pMessage, pLogInfo);
        }

        /*
        * If consumer get `offsetOutOfRange` event, fetch data from the smallest(oldest) offset
        */
        pConsumer.on('offsetOutOfRange', function (topic) {
            reqInstanceHelper.PrintWarn(pConsumerName, '------------- offsetOutOfRange ------------', objLogInfo);
            topic.maxNum = 2;
            pKafka.Offset.fetch([topic], function (err, offsets) {
                var min = Math.min.apply(null, offsets[topic.topic][topic.partition]);
                pConsumer.setOffset(topic.topic, topic.partition, min);
            });
        });
    } catch (error) {
        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, ' ERR-ATMT-CONSUMER-0002', 'Catch Error in startConsuming()...', error);
    }
}

module.exports = {
    StartConsuming: startConsuming
};
/******** End of File **********/