/**
 * Description      : To send the mail SMTP
 * Last Error Code  :  ERR-COM-20078
 */

// Require dependencies
var reqNodeMailer = require("nodemailer");
var reqInstanceHelper = require('../../../common/InstanceHelper');
var reqTranDBHelper = require('../../../instance/TranDBInstance');
var serviceName = 'SMTPMessage';

var smtpTransport = '';
var allSMTPInstance = [];
// To send the mail through SMTP server
function Send(pMailMsg, pLogInfo, pCallback) {
    try {
        if (pMailMsg) {
            var headers = (pMailMsg && pMailMsg.headers) || {};
            var commProcessMsgLog = (pMailMsg && pMailMsg.comm_process_msg_log) || {};
            if (!commProcessMsgLog.attempt_count) {
                commProcessMsgLog.attempt_count = 1;
            }
            var attempt_count = commProcessMsgLog.attempt_count;
            var mServer = pMailMsg.ServerName;
            var mPort = pMailMsg.PortNo;
            var mEmailId = pMailMsg.EMailID;
            var mPwd = pMailMsg.Pwd;
            var mAttachments = [];

            var mailOption = {};
            mailOption.from = mEmailId;
            mailOption.subject = pMailMsg.Subject ? pMailMsg.Subject : 'No Subject';
            if (pMailMsg.To) {
                mailOption.to = pMailMsg.To.trim();
            }
            if (pMailMsg.Cc) {
                mailOption.cc = pMailMsg.Cc.trim();
            }
            if (pMailMsg.Bcc) {
                mailOption.bcc = pMailMsg.Bcc.trim();
            }
            if (pMailMsg.ReplyTo) {
                mailOption.replyTo = pMailMsg.ReplyTo.trim();
            }
            if (pMailMsg.IsBodyHtml == true) {
                mailOption.html = pMailMsg.Body;
            }
            else {
                mailOption.text = pMailMsg.Body;
            }

            // Add attachments
            if (pMailMsg.Attachments) {
                for (var i = 0; i < pMailMsg.Attachments.length; i++) {
                    Object.keys(pMailMsg.Attachments[i]).forEach(function (key) {
                        var objAtt = {};
                        objAtt.filename = key;
                        objAtt.content = pMailMsg.Attachments[i][key];
                        if (typeof objAtt.content == 'string' && objAtt.filename && objAtt.filename.toLowerCase().includes('.pdf')) {
                            objAtt.encoding = 'base64';
                        }
                        mAttachments[i] = objAtt;
                    });
                }
            }

            _PrintInfo(JSON.stringify(mailOption), pLogInfo);
            mailOption.attachments = mAttachments;

            try {
                var smtpConfig = {
                    host: mServer,
                    port: mPort,
                    pool: true,
                };
                if (mEmailId && mPwd) {
                    smtpConfig.auth = {
                        user: mEmailId,
                        pass: mPwd
                    };
                }
                if (smtpConfig.port == '465') {
                    smtpConfig.secure = true; // true for 465, false for other ports
                }
                smtpConfig.connectionTimeout = 20000;
                smtpConfig.greetingTimeout = 2000;
                smtpConfig.socketTimeout = 2000;
                GetSMTPConnection({}, function (error, SMTPInstance) {
                    try {
                        if (SMTPInstance) {
                            // Sending mail
                            _PrintInfo('Attempt Count - ' + attempt_count, pLogInfo);
                            SMTPInstance.sendMail(mailOption, function callbackSendMail(error, response) { //callback
                                try {
                                    var commProcessMsgLogObj = {
                                        attempt_count,
                                        created_date: commProcessMsgLog.created_date || new Date(),
                                        created_by: commProcessMsgLog.created_by,
                                        comm_msg_id: commProcessMsgLog.comm_msg_id,
                                    };
                                    if (error) {
                                        _PrintInfo('Message failure : ' + error, pLogInfo);
                                        // Initiating Retry only for Time out Error
                                        commProcessMsgLogObj.comments = error.stack;
                                        if (error.code == 'ETIMEDOUT' && attempt_count < 3) {
                                            _PrintInfo('Retry Initiated and its Retry Count - ' + attempt_count, pLogInfo);
                                            InsertMailInfo(commProcessMsgLogObj, function () {
                                                commProcessMsgLogObj = null;
                                                commProcessMsgLog.attempt_count = commProcessMsgLog.attempt_count + 1;
                                                setTimeout(function () {
                                                    Send(pMailMsg, pLogInfo, pCallback);
                                                }, 1000);
                                            });
                                        } else {
                                            InsertMailInfo(commProcessMsgLogObj, function () {
                                                commProcessMsgLogObj = null;
                                                _PrintInfo('Retry Process Completed with retry count as ' + attempt_count, pLogInfo);
                                                _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20070', 'Error on sending mail', error, null, pCallback);
                                            });
                                        }
                                    } else {
                                        commProcessMsgLogObj.comments = 'SUCCESS';
                                        InsertMailInfo(commProcessMsgLogObj, function () {
                                            commProcessMsgLogObj = null;
                                            _PrintInfo('Message sent: ' + JSON.stringify(response), pLogInfo);
                                            _PrepareAndSendCallback('SUCCESS', null, '', '', null, null, pCallback);
                                        });
                                    }
                                    // SMTPInstance.close(); // shut down the connection pool, no more messages.  Comment this line out to continue sending emails.
                                } catch (error) {
                                    commProcessMsgLogObj.comments = error.stack;
                                    InsertMailInfo(commProcessMsgLogObj, function () {
                                        commProcessMsgLogObj = null;
                                        _PrintError(pLogInfo, 'Catch Error on sending mail', 'ERR-COM-20076', error);
                                        _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20076', 'Catch Error on sending mail', error, null, pCallback);
                                    });
                                }
                            });
                        }
                    } catch (error) {
                        _PrintError(pLogInfo, 'Catch Error on GetSMTPConnection()', 'ERR-COM-20077', error);
                        _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20077', 'Catch Error on GetSMTPConnection()', error, null, pCallback);
                    }
                });

                function GetSMTPConnection(params, GetSMTPConnectionCB) {
                    try {
                        var smtpInstanceObjKey = mServer + '_' + mPort + '_' + mEmailId;
                        var smtpInstanceObj = {
                            smtpInstanceObjKey: smtpInstanceObjKey
                        };
                        var smtpInstanceObjKeyIndex = allSMTPInstance.findIndex(obj => { if (obj.smtpInstanceObjKey == smtpInstanceObjKey) return true });
                        // Declare SMTPServer
                        if (smtpTransport == '' || smtpInstanceObjKeyIndex == -1) {
                            _PrintInfo('SMTP Connection is not Created for key - ' + smtpInstanceObjKey, pLogInfo);
                            smtpTransport = reqNodeMailer.createTransport(smtpConfig);
                            _PrintInfo('Verifying the SMTP Connection', pLogInfo);
                            // verify connection configuration
                            smtpTransport.verify(function (error, success) {
                                if (error) {
                                    smtpTransport = '';
                                    _PrintError(pLogInfo, 'Error While Verifying the SMTP Connection..', 'ERR-COM-20074', error);
                                    _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20074', 'Error While Verifying the SMTP Connection..', error, null, pCallback);
                                } else {
                                    _PrintInfo('Successfully Verified the SMTP Connection', pLogInfo);
                                    if (smtpInstanceObjKeyIndex == -1) {
                                        smtpInstanceObj.smtpInstanceObjValue = smtpTransport;
                                        allSMTPInstance.push(smtpInstanceObj);
                                    }
                                    _PrintInfo('Storing the SMTP Connection in Memory', pLogInfo);
                                    GetSMTPConnectionCB(null, smtpTransport); // Storing nto the global obj
                                }
                            });
                        } else {
                            _PrintInfo('The SMTP Connection Already Existed for key - ' + smtpInstanceObjKey, pLogInfo);
                            smtpTransport = allSMTPInstance[smtpInstanceObjKeyIndex].smtpInstanceObjValue;
                            _PrintInfo('The SMTP Connection Idle Status - ' + smtpTransport.isIdle(), pLogInfo);
                            if (!smtpTransport.isIdle()) {
                                smtpTransport = reqNodeMailer.createTransport(smtpConfig);
                                allSMTPInstance.splice(smtpInstanceObjKeyIndex, 1);
                                smtpInstanceObj.smtpInstanceObjValue = smtpTransport;
                                allSMTPInstance.push(smtpInstanceObj);
                            }
                            GetSMTPConnectionCB(null, smtpTransport); //Get from Global Object
                        }
                    } catch (error) {
                        _PrintError(pLogInfo, 'Catch Error While Verifying the SMTP Connection..', 'ERR-COM-20075', error);
                        _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20075', 'Catch Error While Verifying the SMTP Connection..', error, null, pCallback);
                    }
                }

                function InsertMailInfo(params, InsertMailInfoCB) {
                    try {
                        reqTranDBHelper.GetTranDBConn(headers, false, function (tran_db_instance) {
                            reqInstanceHelper.PrintInfo(serviceName, 'Going to Insert the "COMM_PROCESS_MESSAGE_LOG" Table...', pLogInfo);
                            reqTranDBHelper.InsertTranDB(tran_db_instance, 'COMM_PROCESS_MESSAGE_LOG', [params], pLogInfo, function (result, error) {
                                if (error) {
                                    reqInstanceHelper.PrintError(serviceName, pLogInfo, 'ERR-COM-20078', 'Error While Inserting Data in the COMM_PROCESS_MESSAGE_LOG Table...', error);
                                } else {
                                    reqInstanceHelper.PrintInfo(serviceName, 'Insert in the "COMM_PROCESS_MESSAGE_LOG" Table Process Completed...', pLogInfo);
                                }
                                InsertMailInfoCB(null, 'SUCCESS');
                            });
                        });
                    } catch (error) {
                        InsertMailInfoCB(error, null);
                    }
                }
            } catch (error) {
                return _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20071', 'Error on sending mail', error, null, pCallback);
            }
        }
    } catch (error) {
        return _PrepareAndSendCallback('FAILURE', null, 'ERR-COM-20072', 'Error on preparing mail option', error, null, pCallback);
    }
}

// To print the error message
function _PrintError(pLogInfo, pMessage, pErrorCode, pError) {
    reqInstanceHelper.PrintError('SMTPMessage', pLogInfo, pErrorCode, pMessage, pError);
}

// To print the information message
function _PrintInfo(pMessage, pLogInfo) {
    reqInstanceHelper.PrintInfo('SMTPMessage', pMessage, pLogInfo);
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

module.exports = {
    SendMail: Send
};
/********* End of File *************/