/*  
Read comm_process_data table and get the data 

*/

var reqAsync = require('async');
var reqLinq = require('node-linq').LINQ;
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance');
var reqSrvHlpr = require('./ServiceHelper/ServiceHelper');
var reqComm = require('../../../../torus-references/communication/core/SendMessage');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var cron = require('node-cron');

var serviceName = 'SendMessage';
var arrRoutingKeys = []; // To Store All the Routing Keys

// router.post('/MessageCreator', function (appRequest, appResponse) {

function MessageCreator(request, startupCallback) {
    _PrintInfo('MessageCreator started..', '');
    var objLogInfo = {};
    var strReqHeader = request.Header;
    var routingkey = strReqHeader.routingkey;
    if (arrRoutingKeys.indexOf(routingkey) == -1) {
        var objRoutingKey = {
            routingkey: routingkey,
            isDone: true,
            lastLoopingCount: 0,
            maxLoopingCount: 180,
            recoveryProcess: true,
            objLogInfo
        };
        arrRoutingKeys.push(objRoutingKey);
    }
    var routingKeyIndex = arrRoutingKeys.findIndex(obj => obj.routingkey == routingkey);
    cron.schedule('*/10 * * * * *', () => {
        arrRoutingKeys[routingKeyIndex].lastLoopingCount++;
        if (arrRoutingKeys[routingKeyIndex].isDone) {
            arrRoutingKeys[routingKeyIndex].isDone = false;
            _PrintInfo('--------------Message Creator Cron Job Start--------------');
            runner(strReqHeader, function () {
                arrRoutingKeys[routingKeyIndex].isDone = true;
                arrRoutingKeys[routingKeyIndex].lastLoopingCount = 0;
                _PrintInfo('--------------Message Creator Cron Job End--------------');
            });
        } else {
            reqInstanceHelper.PrintInfo(serviceName, routingkey + '  Message creator - Already a cron thread is processing. So skiping this cron thread.  IsDone = ' + arrRoutingKeys[routingKeyIndex].isDone, objLogInfo);
            if (arrRoutingKeys[routingKeyIndex].lastLoopingCount > arrRoutingKeys[routingKeyIndex].maxLoopingCount) {
                reqInstanceHelper.PrintInfo('Looping Count Exceeds the Maximum Looping Count...So Resetting the ISDONE to True', objLogInfo);
                arrRoutingKeys[routingKeyIndex].isDone = true;
                arrRoutingKeys[routingKeyIndex].recoveryProcess = true;
                arrRoutingKeys[routingKeyIndex].lastLoopingCount = 0;
            }
        }
        // runner(strReqHeader);
    });
    startupCallback('Started');
}

function _PrintInfo(pMessage, pLogInfo) {
    reqInstanceHelper.PrintInfo('SendMessage', pMessage, pLogInfo);
}

function runner(pHeader, runnerCB) {
    var mOrm = 'knex';
    var objLogInfo = {};
    reqFXDBInstance.GetFXDBConnection(pHeader, 'dep_cas', objLogInfo, function (depSession) {
        reqFXDBInstance.GetFXDBConnection(pHeader, 'clt_cas', objLogInfo, function (cltSession) {
            reqFXDBInstance.GetFXDBConnection(pHeader, 'res_cas', objLogInfo, function (resSession) {
                reqTranDBHelper.GetTranDBConn(pHeader, false, function (TranDbsession) {

                    var reqObj = {};
                    var cond = {
                        is_processed: 'N'
                    };
                    reqObj.cond = cond;
                    reqObj.Loop = true;

                    getCommProcessData(reqObj);

                    //  Get comm process data 
                    function getCommProcessData(reqObj) {
                        try {
                            var prctid = reqObj.cond.prct_id || '';
                            _PrintInfo('query from Comm process data started ', objLogInfo);
                            reqTranDBHelper.GetTableFromTranDB(TranDbsession, 'COMM_PROCESS_DATA', reqObj.cond, objLogInfo, function (Res, err) {
                                try {
                                    if (err) {
                                        runnerCB();
                                    } else if (Res.length) {
                                        if (reqObj.Loop) {
                                            _PrintInfo('Get the Prctid from comm process data and query again to get the all data belongs to prct id ', objLogInfo);
                                            reqObj.Loop = false;
                                            prctid = Res[0].prct_id;
                                            reqObj.cond.prct_id = prctid;
                                            getCommProcessData(reqObj);
                                        } else {
                                            if (Res[0].session_info) {
                                                var sessioninfo = JSON.parse(Res[0].session_info);
                                                sessioninfo.event_code = Res[0].event_code;
                                                sessioninfo.wftpa_id = Res[0].wftpa_id;
                                                sessioninfo.dt_code = Res[0].dt_code;
                                                sessioninfo.dtt_code = Res[0].dtt_code;

                                                //  Process Modeller setup

                                                var whereCond = {};
                                                whereCond.commmg_code = Res[0].commmg_code;
                                                whereCond.wftpa_id = Res[0].wftpa_id;
                                                whereCond.event_code = Res[0].event_code;
                                                whereCond.app_id = sessioninfo.APP_ID;
                                                var staticCommProcessData = Res[0].static_data;
                                                sessioninfo.staticCommProcessData = staticCommProcessData;
                                                getcommTemplateDeatil(whereCond).then((template) => {
                                                    if (template.length) {
                                                        gettranquerydetail(reqObj.cond.prct_id, template, sessioninfo);
                                                    } else {
                                                        // UI Modeller Get data from COMM_INFO table with wftpa_id dt, dtt event code as "DEFAULT" 
                                                        var defaultWhereCOnd = {};
                                                        defaultWhereCOnd.commmg_code = Res[0].commmg_code;
                                                        defaultWhereCOnd.wftpa_id = "DEFAULT";
                                                        defaultWhereCOnd.event_code = "DEFAULT";
                                                        defaultWhereCOnd.dt_code = "DEFAULT";
                                                        defaultWhereCOnd.dtt_code = "DEFAULT";
                                                        defaultWhereCOnd.app_id = '0';
                                                        getcommTemplateDeatil(defaultWhereCOnd).then((defaultTemplate) => {
                                                            if (defaultTemplate.length) {
                                                                gettranquerydetail(reqObj.cond.prct_id, defaultTemplate, sessioninfo);
                                                            } else {
                                                                _PrintInfo('Template Not available.' + Res[0].commmg_code, objLogInfo);

                                                                //  Marked the comm process data as processed 
                                                                var updaterow = {};
                                                                updaterow.is_processed = 'Y';
                                                                updaterow.comments = 'Template Not available';
                                                                var updatecond = {};
                                                                updatecond.prct_id = prctid;
                                                                updatecond.commmg_code = Res[0].commmg_code;
                                                                updatetable('COMM_PROCESS_DATA', updaterow, updatecond, objLogInfo).then((res) => {
                                                                    runnerCB();
                                                                });
                                                            }
                                                        }).catch((error) => {
                                                            console.log(error);
                                                            runnerCB();
                                                        });
                                                    }
                                                }).catch((error) => {
                                                    //  Error occured update COMM_PROCESS_DATA as is processed as Y with comment
                                                    console.log(error);
                                                    var updareRow = {
                                                        is_processed: 'Y'
                                                    };
                                                    var updareCond = {
                                                        prct_id: prctid,
                                                    };
                                                    updatetable('COMM_PROCESS_DATA', updareRow, updareCond, objLogInfo).then(function () {
                                                        runnerCB();
                                                    }).catch((error) => {
                                                        runnerCB();
                                                    });
                                                });

                                            } else {
                                                var updareRow = {
                                                    is_processed: 'Y',
                                                    comments: "SESSION_INFO column is null.It required to create comm_process_messag data"
                                                };
                                                var updareCond = {
                                                    commpd_id: Res[0].commpd_id
                                                };
                                                updatetable('COMM_PROCESS_DATA', updareRow, updareCond, objLogInfo).then(function () {
                                                    runnerCB();
                                                }).catch((error) => {
                                                    runnerCB();
                                                });
                                            }
                                        }
                                    } else {
                                        _PrintInfo('~ ~ ~ ~ ~ ~ ~Comm process data not available ~ ~ ~ ~ ~ ~ ~', objLogInfo);
                                        runnerCB();
                                    }

                                } catch (error) {
                                    var updareRow = {
                                        is_processed: 'Y',
                                        comments: JSON.stringify(error)
                                    };
                                    var updareCond = {
                                        commpd_id: Res[0].commpd_id
                                    };
                                    updatetable('COMM_PROCESS_DATA', updareRow, updareCond, objLogInfo).then(function () {
                                        runnerCB();
                                    }).catch((error) => {
                                        runnerCB();
                                    });
                                }
                            });
                        } catch (error) {
                            _PrintInfo('Exception occured updatetable ' + error, objLogInfo);
                            runnerCB();
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
                                        reject();
                                    } else {
                                        resolve(pRes.rows);
                                    }
                                });
                            });
                        } catch (error) {
                            _PrintInfo('Exception occured updatetable ' + error, objLogInfo);
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
                                        // if (pTemplt.trn_qry) {
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
                                                    pCallback();
                                                }).catch((err) => {
                                                    _PrintInfo('preparemailcomminsert err' + err, objLogInfo);
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
                                        var updaterow = {};
                                        updaterow.is_processed = 'Y';
                                        updaterow.comments = JSON.stringify(error);
                                        var updatecond = {};
                                        updatecond.prct_id = prctid;
                                        updatetable('COMM_PROCESS_DATA', updaterow, updatecond, objLogInfo).then(function (updateRes) {
                                            _PrintInfo('COMM_PROCESS_DATA processed successfully', objLogInfo);
                                            runnerCB();
                                        }).catch(function (error) {
                                            _PrintInfo('Error occured while update comm process data table' + error, objLogInfo);
                                            runnerCB();
                                        });
                                    }
                                });
                            }, function (error) {
                                var updaterow = {};
                                updaterow.is_processed = 'Y';
                                var updatecond = {};
                                updatecond.prct_id = prctid;
                                if (error) {
                                    _PrintInfo('Exception occured gettranquerydetail ' + error, objLogInfo);
                                    updaterow.comments = JSON.stringify(error);
                                }
                                updatetable('COMM_PROCESS_DATA', updaterow, updatecond, objLogInfo).then(function (updateRes) {
                                    _PrintInfo('COMM_PROCESS_DATA processed successfully', objLogInfo);
                                    runnerCB();
                                }).catch(function (error) {
                                    _PrintInfo('Error occured while update comm process data table' + error, objLogInfo);
                                    runnerCB();
                                });
                            });
                        } catch (error) {
                            _PrintInfo('Exception occured updatetable ' + error, objLogInfo);
                            var updareRow = {
                                is_processed: 'Y',
                                comments: JSON.stringify(error)
                            };
                            var updareCond = {
                                prct_id: prctid,

                            };
                            updatetable('COMM_PROCESS_DATA', updareRow, updareCond, objLogInfo).then(function () {
                                runnerCB();
                            }).catch((error) => {
                                runnerCB();
                            });
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
                                var strTemp_info = JSON.parse(pTemplate.TEMPLATE_INFO.TEMP_INFO);
                                reqAsync.forEachOfSeries(pData, function (row, indx, mailcallback) {
                                    if (pTemplate.TEMPLATE_INFO.COMMMT_MODE.toUpperCase() == 'INDIVIDUAL') {
                                        ObjAdress = {};
                                        ObjAdress.IsBodyHtml = true; //Attachment

                                        // PREPARE TO ADDRESS
                                        var Toaddr = [];
                                        var Ccaddr = [];
                                        var Bccaddr = [];
                                        for (var i = 0; i < pTemplate.CONTACT_INFOs.length; i++) {
                                            var addr = pTemplate.CONTACT_INFOs[i];
                                            // TO
                                            if (addr.ADDRESS_TYPE.toUpperCase() === 'TO')
                                                Toaddr.push(reqComm.GetDestAddressIndividual(addr, row));
                                            // CC
                                            if (addr.ADDRESS_TYPE.toUpperCase() === 'CC')
                                                Ccaddr.push(reqComm.GetDestAddressIndividual(addr, row));
                                            // BCC
                                            if (addr.ADDRESS_TYPE.toUpperCase() === 'BCC')
                                                Bccaddr.push(reqComm.GetDestAddressIndividual(addr, row));
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
                                        insertObj.created_date = reqDateFormatter.GetTenantCurrentDateTime(pHeader, objLogInfo);
                                        insertObj.prct_id = prctid;
                                        insertObj.wftpa_id = psessInfo.wftpa_id;
                                        insertObj.event_code = psessInfo.event_code;
                                        insertObj.trn_id = row.trn_id;
                                        insertObj.status = 'CREATED';
                                        insertObj.created_by = psessInfo.U_ID;
                                        insertObj.attempt_count = 1;
                                        insertObj.commmt_code = pTemplate.commmt_code;

                                        inserttable('COMM_PROCESS_MESSAGE', [insertObj], pLogInfo).then(function (commsgid) {
                                            _PrintInfo('insert callback success. mailcallback going to called', pLogInfo);
                                            mailcallback();
                                        }).catch(function (error) {
                                            console.log(error);
                                            mailcallback();
                                        });
                                    } else {
                                        _PrintInfo('Communication MODE is GROUP', pLogInfo);
                                        ObjAdress = {};
                                        ObjAdress.IsBodyHtml = true;
                                        // PREPARE TO ADDRESS
                                        var Toaddr = [];
                                        var Ccaddr = [];
                                        var Bccaddr = [];
                                        for (var i = 0; i < pTemplate.CONTACT_INFOs.length; i++) {
                                            var addr = pTemplate.CONTACT_INFOs[i];
                                            // TO
                                            if (addr.ADDRESS_TYPE.toUpperCase() === 'TO')
                                                Toaddr.push(reqComm.GetDestAddressGroup(addr, pData));
                                            // CC
                                            if (addr.ADDRESS_TYPE.toUpperCase() === 'CC')
                                                Ccaddr.push(reqComm.GetDestAddressGroup(addr, pData));
                                            // BCC
                                            if (addr.ADDRESS_TYPE.toUpperCase() === 'BCC')
                                                Bccaddr.push(reqComm.GetDestAddressGroup(addr, pData));
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
                                        strMsg = reqComm.PrepareMessage(strMsg, pData, null, pLogInfo);
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
                                        var insertObj = {};
                                        insertObj.message = JSON.stringify(Mailinfo);
                                        insertObj.type = 'MAIL';
                                        insertObj.created_date = reqDateFormatter.GetTenantCurrentDateTime(pHeader, objLogInfo);
                                        insertObj.prct_id = prctid;
                                        insertObj.status = 'CREATED';
                                        insertObj.wftpa_id = psessInfo.wftpa_id;
                                        insertObj.event_code = psessInfo.event_code;
                                        insertObj.trn_id = row.trn_id;
                                        insertObj.created_by = psessInfo.U_ID;
                                        insertObj.attempt_count = 1;
                                        insertObj.commmt_code = pTemplate.commmt_code;
                                        _PrintInfo('COMM_PROCESS_MESSAGE insert started', objLogInfo);
                                        inserttable('COMM_PROCESS_MESSAGE', [insertObj], pLogInfo).then(function (commsgid) {
                                            _PrintInfo('COMM_PROCESS_MESSAGE insert Success', objLogInfo);
                                            mailcallback();
                                        }).catch(function (error) {
                                            _PrintInfo('Error occured inserttable MAIL COMM_PROCESS_MESSAGE' + error, pLogInfo);
                                            // mailcallback();
                                            var updaterow = {};
                                            updaterow.is_processed = 'Y';
                                            updaterow.comments = JSON.stringify(error);
                                            var updatecond = {};
                                            updatecond.prct_id = prctid;
                                            updatetable('COMM_PROCESS_DATA', updaterow, updatecond, objLogInfo).then(function (updateRes) {
                                                _PrintInfo('COMM_PROCESS_DATA processed successfully', objLogInfo);
                                                runnerCB();
                                            }).catch(function (error) {
                                                _PrintInfo('Error occured while update comm process data table' + error, objLogInfo);
                                                runnerCB();
                                            });
                                        });
                                    }
                                }, function (error) {
                                    if (error) {
                                        _PrintInfo('Error occured _MailPreparation function ' + error, pLogInfo);
                                        resolve(error);
                                    } else {
                                        _PrintInfo('reqAsync.forEachSeries success ' + mailstatus, pLogInfo);
                                        resolve(mailstatus);
                                    }
                                });
                            } catch (ex) {
                                _PrintInfo('Exception occured ' + ex, objLogInfo);
                                resolve(ex);
                            }
                        });
                    }


                    // To prepare message and Send SMS
                    function preparesmscomminsert(pTemplate, pData, prctid, psessInfo, pLogInfo) {
                        return new Promise((ResolveRes, rejecterr) => {
                            var ObjMessage = {};
                            try {
                                _PrintInfo('Prepare sms comm mode is | ' + pTemplate.TEMPLATE_INFO.COMMMT_MODE, objLogInfo);
                                var strTemp_info = JSON.parse(pTemplate.TEMPLATE_INFO.TEMP_INFO);
                                reqAsync.forEachOfSeries(pData, function (row, index, smscallback) {
                                    if (pTemplate.TEMPLATE_INFO.COMMMT_MODE.toUpperCase() == 'INDIVIDUAL') {
                                        var strMsg = pTemplate.TEMPLATE_INFO.COMMMT_MESSAGE;
                                        strMsg = reqComm.PrepareMessage(strMsg, null, row);
                                        ObjMessage.Message = strMsg;

                                        // Prepare TO Address
                                        var Toaddr = [];
                                        for (var j = 0; j < pTemplate.CONTACT_INFOs.length; j++) {
                                            var addr = pTemplate.CONTACT_INFOs[j];
                                            // TO
                                            if (addr.ADDRESS_TYPE.toUpperCase() === 'TO')
                                                Toaddr.push(reqComm.GetDestAddressIndividual(addr, row));
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
                                            insertObj.created_date = reqDateFormatter.GetTenantCurrentDateTime(pHeader, objLogInfo);
                                            insertObj.prct_id = prctid;
                                            insertObj.wftpa_id = psessInfo.wftpa_id;
                                            insertObj.event_code = psessInfo.event_code;
                                            insertObj.trn_id = row.trn_id;
                                            insertObj.status = 'CREATED';
                                            insertObj.created_by = psessInfo.U_ID;
                                            insertObj.attempt_count = 1;
                                            insertObj.commmt_code = pTemplate.commmt_code;
                                            inserttable('COMM_PROCESS_MESSAGE', [insertObj], pLogInfo).then(function (commsgid) {
                                                smscallback();
                                            }).catch(function (error) {
                                                console.log('Error occured inserttable SMS COMM_PROCESS_MESSAGE ' + error);
                                                smscallback();
                                            });
                                        }
                                    } else {
                                        var strMsg = reqComm.PrepareMessage(pTemplate.TEMPLATE_INFO.COMMMT_MESSAGE, pData, null);
                                        ObjMessage.Message = strMsg;

                                        // Prepare TO Address
                                        var Toaddr = [];
                                        for (var i = 0; i < pTemplate.CONTACT_INFOs.length; i++) {
                                            var addr = pTemplate.CONTACT_INFOs[i];
                                            // TO
                                            if (addr.ADDRESS_TYPE.toUpperCase() === 'TO')
                                                Toaddr.push(reqComm.GetDestAddressGroup(addr, pData));
                                        }
                                        if (Toaddr.length == 0) {
                                            _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20068', '', null, 'Destination not Available', callback);
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
                                            insertObj.created_date = reqDateFormatter.GetTenantCurrentDateTime(pHeader, objLogInfo);
                                            insertObj.prct_id = prctid;
                                            insertObj.status = 'CREATED';
                                            insertObj.created_by = psessInfo.U_ID;
                                            insertObj.wftpa_id = psessInfo.wftpa_id;
                                            insertObj.trn_id = row.trn_id;
                                            insertObj.event_code = psessInfo.event_code;
                                            insertObj.attempt_count = 1;
                                            insertObj.commmt_code = pTemplate.commmt_code;
                                            inserttable('COMM_PROCESS_MESSAGE', [insertObj], pLogInfo).then(function (commsgid) {
                                                smscallback();
                                            }).catch(function (error) {
                                                console.log('Error occured inserttable SMS COMM_PROCESS_MESSAGE ' + error);
                                                smscallback();
                                            });
                                        }
                                    }
                                }, function (error) {
                                    if (error) {
                                        _PrintInfo('Exception occured forEachOfSeries final callback ' + error, objLogInfo);
                                    }
                                    ResolveRes();
                                });
                            } catch (error) {
                                _PrintInfo('Exception occured preparesmscomminsert ' + error, objLogInfo);

                                var updaterow = {};
                                updaterow.is_processed = 'Y';
                                updaterow.comments = JSON.stringify(error);
                                var updatecond = {};
                                updatecond.prct_id = prctid;
                                updatetable('COMM_PROCESS_DATA', updaterow, updatecond, objLogInfo).then(function (updateRes) {
                                    _PrintInfo('COMM_PROCESS_DATA processed successfully', objLogInfo);
                                    ResolveRes();
                                }).catch(function (error) {
                                    _PrintInfo('Error occured while update comm process data table' + error, objLogInfo);
                                    ResolveRes();
                                });
                            }
                        });

                    }


                    // inert the data into tran DB 
                    function inserttable(ptargettbale, insertRows, pLogInfo) {
                        return new Promise((resolve, reject) => {
                            try {
                                _PrintInfo('insert started for table ' + ptargettbale);
                                reqTranDBHelper.InsertTranDBWithAudit(TranDbsession, ptargettbale, insertRows, pLogInfo, function (InsertRes, insertErr) {
                                    if (insertErr) {
                                        reject();
                                    } else {
                                        try {
                                            _PrintInfo('insert success');
                                            var commsgid = InsertRes[0].commpm_id;
                                            resolve(commsgid);
                                        } catch (error) {
                                            console.log('error ' + error);
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
                                reqTranDBHelper.UpdateTranDBWithAudit(TranDbsession, ptargettbale, updaterow, updatecond, pLogInfo, function (updateRes, UpdateErr) {
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
module.exports = {
    MessageCreator: MessageCreator
};              