/**
 * Description      : To send the SMS using given sms gateway url
 * Last ErrorCode   : ERR-SMS-20072
 */

// Require dependencies
var reqLinq = require('node-linq').LINQ;
var reqSMTP = require('./mail/SMTPMessage');
var reqSMSAPI = require('./sms/SMS_API');
var reqCassandraInstance = require('../../instance/CassandraInstance');
var reqServiceHelper = require('../../common/serviceHelper/ServiceHelper');
var reqDBInstance = require('../../instance/DBInstance');
var reqInstanceHelper = require('../../common/InstanceHelper');
var reqTranDBHelper = require('../../instance/TranDBInstance');
var request = require('request');
var reqAsync = require('async');
var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];

const COMMINFO = 'SELECT * FROM COMM_INFO WHERE APP_ID = ? AND WFTPA_ID=? AND DT_CODE=? AND DTT_CODE=? AND EVENT_CODE=? ;';

// To Send Mail for SAVE, DELETE, CHANGE STATUS action if communication is asked for the event
function SendMailFromAction(pReqBody, pHeaders, arrATMTData, objLogInfo) {
    try {
        _PrintInfo('SendMailFromAction has been called.', objLogInfo);
        var strWftpaId = '';
        var strAppId = '';
        var strDTCode = '';
        var strDTTCode = '';
        var strEventCode = '';
        var systemTypeCode = '';
        var currentSystemID = ''; // For Getting Parent System Record Recursively
        var clusterCode = '';
        _InitializeParams(pReqBody, objLogInfo);
        _PrintInfo("DT_CODE : " + strDTCode + " , DTT_CODE :" + strDTTCode + " , WFTPA_ID:" + strWftpaId + " , EVENT_CODE:" + strEventCode, objLogInfo);
        var arrCond = [strAppId, strWftpaId, strDTCode, strDTTCode, strEventCode];

        reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function callbackDBCon(pDepCas) {
            var reqObjGetCommInfo = {
                APP_ID: strAppId,
                WFTPA_ID: strWftpaId,
                DT_CODE: strDTCode,
                DTT_CODE: strDTTCode,
                EVENT_CODE: strEventCode,
                DEP_CAS_CLIENT: pDepCas
            };
            _PrintInfo('Getting Data From COMM_INFO Table', objLogInfo);
            _PrintInfo('-------EVENT_CODE - ' + strEventCode + ' SYSTEM_TYPE - ' + systemTypeCode + '-----------', objLogInfo);
            GetCommInfo(reqObjGetCommInfo, function (pError, pResult) {
                try {
                    if (pError) {
                        _PrintError(objLogInfo, pError, 'ERR-COM-20049');
                    } else {
                        console.log("pResult.rows.length" + pResult.rows.length);
                        if (pResult.rows.length) {
                            pReqBody.TEMPLATECODE = pResult.rows[0].commmg_code;
                            CallCommServiceAPI(pReqBody, pHeaders, arrATMTData, objLogInfo);
                        } else {
                            _PrintInfo('Getting APP_SYSTEM_TO_SYSTEM Data Based on CLUSTER_CODE and APP_ID...', objLogInfo);

                            reqDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function (pCltCas) {
                                var appSysCondObj = {
                                    APP_ID: strAppId,
                                    CLUSTER_CODE: clusterCode
                                };
                                reqDBInstance.GetTableFromFXDB(pCltCas, 'APP_SYSTEM_TO_SYSTEM', [], appSysCondObj, objLogInfo, function (pError, pResult) {
                                    if (pError) {
                                        _PrintError(objLogInfo, 'Error while Querying APP_SYSTEM_TO_SYSTEM Table ' + pError, 'ERR-COM-20070');
                                    } else if (!pResult.rows.length) {
                                        _PrintInfo('There is no Data from APP_SYSTEM_TO_SYSTEM Data Based on CLUSTER_CODE and APP_ID...', objLogInfo);
                                    } else {
                                        var arrParentResult = [];
                                        var GetHierarchyParent = {
                                            resultRows: pResult.rows,
                                            curParentSID: currentSystemID
                                        };
                                        arrParentResult = reqServiceHelper.GetHierarchyParent(GetHierarchyParent);
                                        if (arrParentResult.length) {
                                            reqAsync.forEachOfSeries(arrParentResult, function (parentObj, i, parentObjCB) {
                                                    var conditionCheck;
                                                    conditionCheck = parentObj.st_code;
                                                    if (conditionCheck) {
                                                        reqObjGetCommInfo.SYSTEM_TYPE = parentObj.st_code;
                                                        _PrintInfo('-------EVENT_CODE - ' + strEventCode + ' SYSTEM_TYPE - ' + parentObj.st_code + '-----------', objLogInfo);
                                                        GetCommInfo(reqObjGetCommInfo, function (error, pRes) {
                                                            if (error) {
                                                                parentObjCB(error, null);
                                                            } else if (!pRes.rows.length) {
                                                                parentObjCB(null);
                                                            } else {
                                                                pReqBody.TEMPLATECODE = pResult.rows[0].commmg_code;
                                                                return CallCommServiceAPI(pReqBody, pHeaders, arrATMTData, objLogInfo);
                                                            }
                                                        });
                                                    } else {
                                                        _PrintInfo('St_code is Empty or Does not have Proper Value...', objLogInfo);
                                                        parentObjCB(null);
                                                    }
                                                },
                                                function (error, result) {
                                                    arrParentResult = null;
                                                    _PrintInfo('------- EVENT_CODE - ' + strEventCode + ' SYSTEM_TYPE - DEFAULT -----------', objLogInfo);
                                                    reqObjGetCommInfo.SYSTEM_TYPE = 'DEFAULT';
                                                    GetCommInfo(reqObjGetCommInfo, function (pError, pResult) {
                                                        if (pError) {
                                                            _PrintError(objLogInfo, pError, 'ERR-COM-20072');
                                                        } else if (!pResult.rows.length) {
                                                            _PrintInfo('No communication asked for the event - ' + strEventCode, objLogInfo);
                                                            reqInstanceHelper.DestroyConn('SendMessage', objLogInfo, function (res) {
                                                                _PrintInfo('Connection destroyed', objLogInfo);
                                                            });
                                                        } else {
                                                            pReqBody.TEMPLATECODE = pResult.rows[0].commmg_code;
                                                            CallCommServiceAPI(pReqBody, pHeaders, arrATMTData, objLogInfo);
                                                        }
                                                    });
                                                });
                                        } else {
                                            _PrintInfo('There is No Parent System For Currently Selected System...', objLogInfo);
                                        }
                                    }
                                });
                            });
                        }
                    }
                } catch (error) {
                    _PrintError(objLogInfo, 'Error on SendMailFromAction() - ' + error, 'ERR-COM-20052');
                }
            });
        });

        function _InitializeParams(pClientParam, objLogInfo) {
            try {
                if (pClientParam['WFTPA_ID'] != undefined && pClientParam['WFTPA_ID'] != '')
                    strWftpaId = pClientParam['WFTPA_ID'].toString();

                if (pClientParam['APP_ID'] != undefined && pClientParam['APP_ID'] != '')
                    strAppId = pClientParam['APP_ID'].toString();

                if (pClientParam['DT_CODE'] != undefined && pClientParam['DT_CODE'] != '')
                    strDTCode = pClientParam['DT_CODE'].toString();

                if (pClientParam['DTT_CODE'] != undefined && pClientParam['DTT_CODE'] != '')
                    strDTTCode = pClientParam['DTT_CODE'].toString();

                if (pClientParam['EVENT_CODE'] != undefined && pClientParam['EVENT_CODE'] != '')
                    strEventCode = pClientParam['EVENT_CODE'].toString();
                if (pClientParam.S_ID) {
                    currentSystemID = pClientParam.S_ID || 'Current System ID is Not Available';
                }
                if (pClientParam.ST_CODE) {
                    systemTypeCode = pClientParam.ST_CODE || 'Current System Code is Not Available';
                }
                if (pClientParam.CLUSTER_CODE) {
                    clusterCode = pClientParam.CLUSTER_CODE || 'Cluster Code is Not Available';
                }
            } catch (ex) {
                _PrintError(objLogInfo, 'Error on _InitializeParams() - ' + ex.toString(), 'ERR-COM-20053');
            }
        }
    } catch (ex) {
        _PrintError(objLogInfo, 'Error on SendMailFromAction() - ' + ex.toString(), 'ERR-COM-20054');
    }
}

function GetCommInfo(pReqObj, GetCommInfoCB) {
    try {
        /* pReqObj Should Contains 
         - objLogInfo
         - APP_ID
         - WFTPA_ID
         - DT_CODE
         - DTT_CODE
         - EVENT_CODE
         - SYSTEM_TYPE
         - DEP_CAS_CLIENT
         */
        var commLogInfo = pReqObj.objLogInfo || {};
        var condObj = {
            APP_ID: pReqObj.APP_ID,
            WFTPA_ID: pReqObj.WFTPA_ID,
            DT_CODE: pReqObj.DT_CODE,
            DTT_CODE: pReqObj.DTT_CODE,
            EVENT_CODE: pReqObj.EVENT_CODE
        };

        if (pReqObj.SYSTEM_TYPE) {
            condObj.SYSTEM_TYPE = pReqObj.SYSTEM_TYPE;
        }
        console.log('condObj--------------------------------->>>' + JSON.stringify(condObj));
        reqDBInstance.GetTableFromFXDB(pReqObj.DEP_CAS_CLIENT, 'COMM_INFO', [], condObj, commLogInfo, function (pError, pResult) {
            GetCommInfoCB(pError, pResult);
        });
    } catch (error) {
        GetCommInfoCB(error, null);
    }
}

// Common Function To Call Communication Service SendMessage API
function CallCommServiceAPI(pReqBody, pHeaders, arrATMTData, objLogInfo) {
    try {
        // Comm process data  table insert 
        pReqBody['ATMT_DATA'] = JSON.stringify(arrATMTData);
        _PrintInfo('COMMMG CODE - ' + pReqBody['COMMMG_CODE'], objLogInfo);
        _PrintInfo('Comm Template code - ' + pReqBody['TEMPLATECODE'], objLogInfo);
        _PrintInfo('Items count - ' + arrATMTData.length, objLogInfo);
        delete pReqBody.JSON_DATASET;
        var commReq = {};
        commReq.PARAMS = pReqBody;
        commReq.SESSION_ID = pReqBody.SESSION_ID;
        commReq.PROCESS_INFO = objLogInfo.PROCESS_INFO;

        var uri = pHeaders.origin + '/Communication/SendMessage';
        var options = {
            url: uri,
            method: 'POST',
            json: true,
            headers: {
                'RoutingKey': pHeaders.routingkey,
                'session-id': pHeaders['session-id']
            },
            body: commReq
        };
        _PrintInfo('Calling communication Service with options - ' + JSON.stringify(options), objLogInfo);
        request(options, function (err, httpResponse, resbody) {
            try {
                if (err) {
                    _PrintError(objLogInfo, 'Error in sending Mail ' + err || err.stack, 'ERR-COM-20050');
                } else
                    _PrintInfo('Communication mail successfully called. Response is' + JSON.stringify(resbody), objLogInfo);

            } catch (error) {
                _PrintError(objLogInfo, error || error.stack, 'ERR-COM-20051');
            }
        });
    } catch (error) {
        _PrintError(objLogInfo, error, 'ERR-COM-20071');
    }
}


// Query from cassandra FX DB
function GetTableFromFXDB(pCasIns, pQuery, pValues, pLogInfo, pCallback) {
    try {
        pCasIns.execute(pQuery, pValues, {
            prepare: true
        }, function callbackGetTableFromFXDB(pError, pResult) {
            if (pError)
                _PrintError(pLogInfo, 'Error on executing query', 'ERR-COM-20055', pError, null);
            pCallback(pResult, pError);
        });
    } catch (error) {
        _PrintError(pLogInfo, 'Error on executing query', 'ERR-COM-20056', error, null);
    }
}

// Public function to send message
function SendMessage(pHeaders, pInputParams, pTemplate, pData, pUserEmail, pUserMblNo, pLogInfo, pCallback) {
    try {
        if (pData.length) {
            _PrintInfo('Communication core SendMessage Function has been Called', pLogInfo);
            _PrintInfo('--Input params clientID----' + pInputParams.SessionInfo.CLIENT_ID, pLogInfo);
            _PrintInfo('--Input params TenantID----' + pInputParams.SessionInfo.TENANT_ID, pLogInfo);

            USER_EMAIL_ID = pUserEmail;
            USER_MOBILE_NO = pUserMblNo;

            // Get mail/sms setup from tenant source
            var strCategoryCode = pTemplate.CATEGORY_INFO.COMMC_CODE;
            var strCommType = pTemplate.CATEGORY_INFO.COMMC_CONFIG.CONFIG.TYPE.toUpperCase();
            reqDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', pLogInfo, function CallbackgetFXDBConn(pClientClt) {
                _PrintInfo('Getting comm setup from tenant setup table for category - ' + pTemplate.CATEGORY_INFO.COMMC_CODE, pLogInfo);
                if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                    var cond = {};
                    cond.setup_code = strCommType + '_SETUP';
                    reqServiceHelper.GetSetupJson(pClientClt, cond, objLogInfo, function (res) {
                        if (res.Status == 'SUCCESS') {
                            afterGetsetupJson(res.Data);
                        } else {
                            _PrepareAndSendCallback('FAILURE', null, res.ErrorCode, res.ErrorMsg, res.Error, null, pCallback);
                        }
                    });
                } else {
                    reqDBInstance.GetTableFromFXDB(pClientClt, 'tenant_setup', ['setup_json'], {
                        'CLIENT_ID': pInputParams.SessionInfo.CLIENT_ID,
                        'TENANT_ID': pInputParams.SessionInfo.TENANT_ID ? pInputParams.SessionInfo.TENANT_ID : '0',
                        'CATEGORY': strCommType + '_SETUP'
                    }, pLogInfo, function CallbackGetTableFromFXDB(pError, pResult) {
                        if (pError) {
                            _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20057', 'Error while querying tenant setup ', pError, null, pCallback);
                        } else {
                            afterGetsetupJson(pResult.rows);
                        }
                    });
                }

                function afterGetsetupJson(pResult) {
                    if (pResult != undefined && pResult.length > 0) {
                        _PrintInfo('Tenant setup available for category - ' + strCommType, pLogInfo);
                        // Assign communcation config from tenant setup
                        var strCommSetup = JSON.parse(pResult[0]['setup_json']);
                        pTemplate.CATEGORY_INFO.COMMC_CONFIG.CONFIG[strCommType] = strCommSetup[strCommType];

                        if (strCommType == "MAIL") {
                            _PrintInfo('Communication type is MAIL', pLogInfo);
                            _MailPreparation(pTemplate, pData, pLogInfo, function callbackMailPreparation(pStatus) {
                                return pCallback(pStatus);
                            });
                        } else if (strCommType == "SMS") {
                            _PrintInfo('Communication type is SMS', pLogInfo);
                            _SendSMS(pTemplate, pData, pLogInfo, function callbackMailPreparation(pStatus) {
                                return pCallback(pStatus);
                            });
                        }
                    } else {
                        return _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20058', '', null, 'Tenant setup not available for category - ' + strCommType, pCallback);
                    }
                }
            });
        }
    } catch (error) {
        return _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20059', 'Error on SendMessage()', error, null, pCallback);
    }
}

// To prepare the mail message for sending mail
function _MailPreparation(pTemplate, pData, pLogInfo, pCallback) {
    try {
        var ObjMessage = {};
        if (pTemplate.TEMPLATE_INFO.COMMMT_MODE.toUpperCase() == 'INDIVIDUAL') {
            _PrintInfo('Communication MODE is INDIVIDUAL', pLogInfo);
            var mailstatus = "";
            reqAsync.forEachSeries(pData, function (row, mailcallback) {

                ObjMessage = {};
                ObjMessage.IsBodyHtml = true; //Attachment
                var att;
                if (row['trn_id'] != undefined && row['trn_id'] != null) {
                    var intTRnID = row['trn_id'];
                    att = new reqLinq(pTemplate.ATTACHMENTs).Where(function (attch) {
                        return attch.TRN_ID == intTRnID || attch.TRN_ID == 0;
                    });
                } else {
                    att = pTemplate.ATTACHMENTs;
                }

                if (att != undefined && att != null) {
                    if (att.length > 0) {
                        var arrAtt = [];
                        for (var i = 0; i < att.length; i++) {
                            var objAtt = {};
                            objAtt[att[i].STATIC_ATTACHMENT_NAME] = att[i].STATIC_ATTACHMENT;
                            arrAtt.push(objAtt);
                        }
                        ObjMessage.Attachments = arrAtt;
                    }
                }
                // PREPARE TO ADDRESS
                var Toaddr = [];
                var Ccaddr = [];
                var Bccaddr = [];
                for (var i = 0; i < pTemplate.CONTACT_INFOs.length; i++) {
                    var addr = pTemplate.CONTACT_INFOs[i];
                    // TO
                    if (addr.ADDRESS_TYPE.toUpperCase() === 'TO')
                        Toaddr.push(_GetDestAddressIndividual(addr, row));
                    // CC
                    if (addr.ADDRESS_TYPE.toUpperCase() === 'CC')
                        Ccaddr.push(_GetDestAddressIndividual(addr, row));
                    // BCC
                    if (addr.ADDRESS_TYPE.toUpperCase() === 'BCC')
                        Bccaddr.push(_GetDestAddressIndividual(addr, row));
                }

                if (Toaddr.length == 0 && Ccaddr.length == 0 && Bccaddr.length == 0) {
                    return _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20060', '', null, 'Destination not found', pCallback);
                }

                // TO
                if (Toaddr.length > 0)
                    ObjMessage.To = Toaddr.join();

                // CC
                if (Ccaddr.length > 0)
                    ObjMessage.Cc = Ccaddr.join();

                // BCC
                if (Bccaddr.length > 0)
                    ObjMessage.Bcc = Bccaddr.join();

                var strMsg = pTemplate.TEMPLATE_INFO.COMMMT_MESSAGE.toString();
                var strSubject = pTemplate.TEMPLATE_INFO.COMMMT_SUBJECT.toString();
                strMsg = _PrepareMessage(strMsg, null, row, pLogInfo);
                strSubject = _PrepareMessage(strSubject, null, row, pLogInfo);
                var Mailinfo = {};
                Mailinfo.Message = strMsg;
                Mailinfo.Subject = strSubject;
                Mailinfo.Address = ObjMessage;
                var insertObj = {};
                insertObj.message = Mailinfo;
                insertObj.type = 'MAIL';
                insertObj.created_date = new Date();
                insertObj.prct_id = pLogInfo.prctid;
                insertObj.wftpa_id = pLogInfo.wftpaid;
                insertObj.trn_id = pLogInfo.trn_id;
                insertObj.status = 'CREATED';
                // 

                inserttable('COMM_PROCESS_MESSAGE', [insertObj], pLogInfo).then(function (commsgid) {
                    _SendMail(ObjMessage, pTemplate, strSubject, strMsg, pData, pLogInfo, function callbackSendMail(pStatus) {
                        // return pCallback(pStatus);
                        var updaterow = {
                            status: pStatus.Status
                        };
                        var updatecond = {};
                        updatecond.commpm_id = commsgid;
                        mailstatus = pStatus;
                        updatetable('COMM_PROCESS_MESSAGE', updaterow, updatecond, pLogInfo).then(function () {
                            mailcallback();
                        }).catch(function (error) {
                            _PrintInfo('Error occured updatetable MAIL ' + error, pLogInfo);
                        });

                    });
                }).catch(function (error) {
                    _PrintInfo('Error occured inserttable MAIL ' + error, pLogInfo);
                });
            }, function (error) {
                if (error) {
                    _PrintInfo('Error occured _MailPreparation function ' + error, pLogInfo);
                } else {
                    pCallback(mailstatus);
                }
            });
        } else {
            _PrintInfo('Communication MODE is GROUP', pLogInfo);
            ObjMessage = {};
            ObjMessage.IsBodyHtml = true;

            //Attachment
            var arrAtt = [];
            for (var i = 0; i < pTemplate.ATTACHMENTs.length; i++) {
                var objAtt = {};
                objAtt[pTemplate.ATTACHMENTs[i].STATIC_ATTACHMENT_NAME] = pTemplate.ATTACHMENTs[i].STATIC_ATTACHMENT;
                arrAtt.push(objAtt);
            }

            if (arrAtt.length > 0)
                ObjMessage.Attachments = arrAtt;

            // PREPARE TO ADDRESS
            var Toaddr = [];
            var Ccaddr = [];
            var Bccaddr = [];
            for (var i = 0; i < pTemplate.CONTACT_INFOs.length; i++) {
                var addr = pTemplate.CONTACT_INFOs[i];
                // TO
                if (addr.ADDRESS_TYPE.toUpperCase() === 'TO')
                    Toaddr.push(_GetDestAddressGroup(addr, pData));
                // CC
                if (addr.ADDRESS_TYPE.toUpperCase() === 'CC')
                    Ccaddr.push(_GetDestAddressGroup(addr, pData));
                // BCC
                if (addr.ADDRESS_TYPE.toUpperCase() === 'BCC')
                    Bccaddr.push(_GetDestAddressGroup(addr, pData));
            }

            if (Toaddr.length == 0 && Ccaddr.length == 0 && Bccaddr.length == 0) {
                return _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20061', '', null, 'Destination not found', pCallback);
            }

            // TO
            if (Toaddr.length > 0)
                ObjMessage.To = Toaddr.join();

            // CC
            if (Ccaddr.length > 0)
                ObjMessage.Cc = Ccaddr.join();

            // BCC
            if (Bccaddr.length > 0)
                ObjMessage.Bcc = Bccaddr.join();

            var strMsg = pTemplate.TEMPLATE_INFO.COMMMT_MESSAGE.toString();
            var strSubject = pTemplate.TEMPLATE_INFO.COMMMT_SUBJECT.toString();
            strMsg = _PrepareMessage(strMsg, pData, null, pLogInfo);

            var insertObj = {};
            insertObj.message = ObjMessage;
            insertObj.type = 'MAIL';
            insertObj.created_date = new Date();
            insertObj.prct_id = pLogInfo.prctid;
            insertObj.wftpa_id = pLogInfo.wftpaid;
            insertObj.trn_id = pLogInfo.trn_id;

            inserttable('COMM_PROCESS_MESSAGE', [insertObj], pLogInfo).then(function (commsgid) {
                strSubject = _PrepareMessage(strSubject, pData, null, pLogInfo);
                _SendMail(ObjMessage, pTemplate, strSubject, strMsg, pData, pLogInfo, function callbackSendMail(pStatus) {
                    // return pCallback(pStatus);
                    var updaterow = {
                        status: pStatus.Status
                    };
                    var updatecond = {};
                    updatecond.commpm_id = commsgid;
                    mailstatus = pStatus;
                    updatetable('COMM_PROCESS_MESSAGE', updaterow, updatecond, pLogInfo).then(function () {
                        return pCallback(pStatus);
                    }).catch(function (error) {
                        _PrintInfo('Error occured updatetable MAIL COMM_PROCESS_MESSAGE' + error, pLogInfo);
                        return _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20162', 'Error occured updatetable MAIL COMM_PROCESS_MESSAGE', error, null, pCallback);
                    });

                });
            }).catch(function (error) {
                _PrintInfo('Error occured inserttable MAIL COMM_PROCESS_MESSAGE' + error, pLogInfo);
                return _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20163', 'Error occured inserttable MAIL COMM_PROCESS_MESSAGE', error, null, pCallback);
            });
        }
    } catch (ex) {
        return _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20062', 'Error on _MailPreparation()', ex, null, pCallback);
    }
}

// To send the mail message 
function _SendMail(ObjMessage, pTemplate, pSubject, pMessage, pData, pLogInfo, pCallback) {
    try {
        _PrintInfo('Calling SMTP send mail', pLogInfo);
        ObjMessage.Subject = pSubject;
        ObjMessage.Body = pMessage;
        ObjMessage.ServerName = pTemplate.CATEGORY_INFO.COMMC_CONFIG.CONFIG.MAIL.SERVERNAME;
        ObjMessage.PortNo = pTemplate.CATEGORY_INFO.COMMC_CONFIG.CONFIG.MAIL.PORTNO;
        ObjMessage.EMailID = pTemplate.CATEGORY_INFO.COMMC_CONFIG.CONFIG.MAIL.EMAILID;
        ObjMessage.Pwd = pTemplate.CATEGORY_INFO.COMMC_CONFIG.CONFIG.MAIL.PASSWORD;
        reqSMTP.SendMail(ObjMessage, pLogInfo, function callbackSendMail(pStatus) {
            pCallback(pStatus);
        });
    } catch (ex) {
        return _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20063', 'Error on _SendMail() ', ex, null, pCallback);
    }
}

// Prepare the mail message with replacement variable
function _PrepareMessage(pMessage, pData, pdatarow, pLogInfo) {
    try {
        // PREPARE MESSAGE
        if (pMessage != null && pMessage != '' && pData != null) {
            // REPLACE SESSION VARIABLE
            if (pMessage.toString().indexOf('{SESSION:EMAIL}') > -1) {
                var strMsg = pMessage.toString().trim;
                pMessage = strMsg.toString().replace("{SESSION:EMAIL}", USER_EMAIL_ID);
            }
            if (pMessage.toString().indexOf('{SESSION:MOBILE_NO}') > -1) {
                var strMsg = pMessage.toString().trim;
                pMessage = strMsg.toString().replace('{SESSION:MOBILE_NO}', USER_MOBILE_NO);
            }
        }
        // REPLACE COLUMN VARIABLES
        if (pData != null && pData != undefined) {
            if (pData.length > 0) {
                var row = pData[0];
                Object.keys(row).forEach(function (clmnkey) {
                    var cName = clmnkey;
                    if (pMessage.toString().indexOf("{" + cName.toUpperCase() + "}") > -1 || pMessage.toString().indexOf("{" + cName.toLowerCase() + "}") > -1) {
                        var strMsg = pMessage.toString().trim();

                        var value = new reqLinq(pData).Select(function (row) {
                            return row[cName];
                        }).ToArray();
                        var regEx = new RegExp("{" + cName + "}", "ig"); // find string with ignore case
                        pMessage = strMsg.replace(regEx, value.join());
                    }
                });
            }
        } else if (pdatarow != null && pdatarow != undefined) {
            Object.keys(pdatarow).forEach(function (clmnkey) {
                var cName = clmnkey;
                if (pMessage.toString().indexOf("{" + cName.toUpperCase() + "}") > -1 || pMessage.toString().indexOf("{" + cName.toLowerCase() + "}") > -1) {
                    var strMsg = pMessage.toString().trim();
                    var value = (pdatarow[cName] === null || pdatarow[cName] === undefined || pdatarow[cName] === "") ? ' - ' : pdatarow[cName];
                    var regEx = new RegExp("{" + cName + "}", "ig"); // find string with ignore case
                    pMessage = strMsg.replace(regEx, value);
                }
            });
        }
        return pMessage;
    } catch (ex) {
        _PrintError(pLogInfo, 'Error on _PrepareMessage() - ' + ex.toString(), 'ERR-COM-20064');
    }
}

// To find the addressgroup
function _GetDestAddressGroup(pContact, pData) {
    var clmnVal = '';
    try {
        if (pContact.COLUMN_NAME != '' && pData != null && pData != undefined && pData.length > 0)
            clmnVal = pData[0][pContact.COLUMN_NAME.toLowerCase()];

        if (clmnVal == null || clmnVal == undefined || clmnVal == '')
            clmnVal = pContact.STATIC_ADDRESS;

        if (clmnVal.toUpperCase() == 'SESSION:EMAIL')
            return USER_EMAIL_ID;
        else if (clmnVal.toUpperCase() == 'SESSION:MOBILE_NO')
            return USER_MOBILE_NO;
    } catch (error) {
        _PrintError(pLogInfo, 'Error on _GetDestAddressGroup()', 'ERR-COM-20065', error, null);
    }
    return clmnVal;
}

// To find the individual address
function _GetDestAddressIndividual(pContact, pRow) {
    var clmnVal = '';
    try {
        if (pContact.COLUMN_NAME && pRow)
            clmnVal = pRow[pContact.COLUMN_NAME.toLowerCase()];

        if (clmnVal == null || clmnVal == undefined || clmnVal == '') {
            clmnVal = pContact.STATIC_ADDRESS;
        }
        else {
            clmnVal = clmnVal + ',' + pContact.STATIC_ADDRESS;
        }

        if (clmnVal.toUpperCase() == 'SESSION:EMAIL')
            return USER_EMAIL_ID;
        else if (clmnVal.toUpperCase() == 'SESSION:MOBILE_NO')
            return USER_MOBILE_NO;
    } catch (error) {
        _PrintError(null, 'Error on _GetDestAddressIndividual() ', 'ERR-COM-20066', error, null);
    }
    return clmnVal;
}

// To prepare message and Send SMS
function _SendSMS(pTemplate, pData, pLogInfo, callback) {
    var ObjMessage = {};
    try {
        if (pTemplate.TEMPLATE_INFO.COMMMT_MODE.toUpperCase() == 'INDIVIDUAL') {
            // for (var i = 0; i < pData.length; i++) {
            reqAsync.forEachSeries(pData, function (row, smscallback) {
                // var row = pData[i];
                ObjMessage.URL = pTemplate.CATEGORY_INFO.COMMC_CONFIG.CONFIG.SMS.URL;
                var strMsg = pTemplate.TEMPLATE_INFO.COMMMT_MESSAGE;
                strMsg = _PrepareMessage(strMsg, null, row);
                ObjMessage.Message = strMsg;

                // Prepare TO Address
                var Toaddr = [];
                for (var j = 0; j < pTemplate.CONTACT_INFOs.length; j++) {
                    var addr = pTemplate.CONTACT_INFOs[j];
                    // TO
                    if (addr.ADDRESS_TYPE.toUpperCase() === 'TO')
                        Toaddr.push(_GetDestAddressIndividual(addr, row));
                }
                if (Toaddr.length == 0) {
                    _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20067', '', null, 'Destination not Available', callback);
                } else {
                    ObjMessage.To = Toaddr.join();

                    var insertObj = {};
                    insertObj.message = ObjMessage;
                    insertObj.type = 'SMS';
                    insertObj.created_date = new Date();
                    insertObj.prct_id = pLogInfo.prctid;
                    insertObj.wftpa_id = pLogInfo.wftpaid;
                    insertObj.trn_id = pLogInfo.trn_id;

                    inserttable('COMM_PROCESS_MESSAGE', [insertObj], pLogInfo).then(function (commsgid) {
                        // reqTranDBHelper.InsertTranDB(pLogInfo.DBSession, 'COMM_PROCESS_MESSAGE', [insertObj], pLogInfo, function (res, err) {
                        reqSMSAPI.SendSMS(ObjMessage, pLogInfo, function callbackSendSMS(pStatus) {
                            var updaterow = {
                                status: pStatus.Status
                            };
                            var updatecond = {};
                            updatecond.commpm_id = commsgid;
                            mailstatus = pStatus;
                            updatetable('COMM_PROCESS_MESSAGE', updaterow, updatecond, pLogInfo).then(function () {
                                smscallback();
                            }).catch(function (error) {
                                console.log('Error occured updatetable SMS COMM_PROCESS_MESSAGE' + error);
                            });
                        });

                    }).catch(function (error) {
                        console.log('Error occured inserttable SMS COMM_PROCESS_MESSAGE' + error);
                    });
                }
            }, function (error) {
                callback(mailstatus);
            });

            // }
        } else {
            ObjMessage.URL = pTemplate.CATEGORY_INFO.COMMC_CONFIG.CONFIG.SMS.URL;
            var strMsg = _PrepareMessage(pTemplate.TEMPLATE_INFO.COMMMT_MESSAGE, pData, null);
            ObjMessage.Message = strMsg;

            // Prepare TO Address
            var Toaddr = [];
            for (var i = 0; i < pTemplate.CONTACT_INFOs.length; i++) {
                var addr = pTemplate.CONTACT_INFOs[i];
                // TO
                if (addr.ADDRESS_TYPE.toUpperCase() === 'TO')
                    Toaddr.push(_GetDestAddressGroup(addr, pData));
            }
            if (Toaddr.length == 0) {
                _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20068', '', null, 'Destination not Available', callback);
            } else {
                ObjMessage.To = Toaddr.join();
                // reqSMSAPI.SendSMS(ObjMessage, pLogInfo, function callbackSendSMS(pStatus) {
                //     callback(pStatus);
                // });
                var insertObj = {};
                insertObj.message = ObjMessage;
                insertObj.type = 'SMS';
                insertObj.created_date = new Date();
                insertObj.prct_id = pLogInfo.prctid;
                insertObj.wftpa_id = pLogInfo.wftpaid;

                inserttable('COMM_PROCESS_MESSAGE', [insertObj], pLogInfo).then(function (commsgid) {
                    // reqTranDBHelper.InsertTranDB(pLogInfo.DBSession, 'COMM_PROCESS_MESSAGE', [insertObj], pLogInfo, function (res, err) {
                    reqSMSAPI.SendSMS(ObjMessage, pLogInfo, function callbackSendSMS(pStatus) {
                        var updaterow = {
                            status: pStatus.Status
                        };
                        var updatecond = {};
                        updatecond.commpm_id = commsgid;
                        mailstatus = pStatus;
                        updatetable('COMM_PROCESS_MESSAGE', updaterow, updatecond, pLogInfo).then(function () {
                            callback(pStatus);
                        }).catch(function (error) {

                        });
                    });
                });
            }
        }
    } catch (ex) {
        _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20069', 'Error on _SendSMS() ', ex, null, callback);
    }
}

// to insert the value into targe table.

function inserttable(ptargettbale, insertRows, pLogInfo) {
    try {
        return new Promise((resolve, reject) => {
            reqTranDBHelper.InsertTranDB(pLogInfo.DBSession, ptargettbale, insertRows, pLogInfo, function (InsertRes, insertErr) {
                if (insertErr) {

                } else {
                    var commsgid = InsertRes[0].commpm_id;
                    resolve(commsgid);
                }

            });
        });

    } catch (error) {

    }
}


function updatetable(ptargettbale, updateRow, updateCond, pLogInfo) {
    try {
        return new Promise((resolve, reject) => {
            reqTranDBHelper.UpdateTranDB(pLogInfo.DBSession, ptargettbale, updateRow, updateCond, pLogInfo, function (InsertRes, insertErr) {
                if (insertErr) {
                    reject(insertErr);
                } else {
                    resolve();
                }

            });
        });

    } catch (error) {
        _PrintInfo('Exception occured ' + error, pLogInfo);
    }
}

// To print the error message
function _PrintError(pLogInfo, pMessage, pErrorCode, pWarning) {
    reqInstanceHelper.PrintError('SendMessage', pMessage, pErrorCode, pLogInfo);
}

// To print the information
function _PrintInfo(pMessage, pLogInfo) {
    reqInstanceHelper.PrintInfo('SendMessage', pMessage, pLogInfo);
}

// Prepare callback object
function _PrepareAndSendCallback(pStatus, pData, pErrorCode, pErrMsg, pError, pWarning, pCallback) {
    var pCallbackObj = {
        Status: pStatus,
        Data: pData,
        ErrorCode: pErrorCode,
        ErrorMsg: pErrMsg,
        Error: pError,
        Warning: pWarning
    };
    return pCallback(pCallbackObj);
}
module.exports = {
    SendMessage: SendMessage,
    SendMailFromAction: SendMailFromAction,
    GetDestAddressIndividual: _GetDestAddressIndividual,
    GetDestAddressGroup: _GetDestAddressGroup,
    PrepareMessage: _PrepareMessage
};
/********* End of File *************/