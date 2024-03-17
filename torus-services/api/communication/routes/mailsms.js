/**
 * Api_Name         : /MailSms
 * Description      : To send the communication like MAIL/SMS
 * Last ErrorCode   : ERR-COM-25009
 */

// Require dependencies
var modPath = '../../../../node_modules/';
var reqAsync = require('async');
var cron = require('node-cron');
var reqBase64 = require(modPath + 'base64-js');
var reqTranDBHelper = require('../../../../torus-references/instance/TranDBInstance');
var reqInstanceHelper = require('../../../../torus-references/common/InstanceHelper');
var reqFXDBInstance = require('../../../../torus-references/instance/DBInstance');
var reqSMTP = require('../../../../torus-references/communication/core/mail/SMTPMessage');
var reqSMSAPI = require('../../../../torus-references/communication/core/sms/SMS_API');
var reqDateFormatter = require('../../../../torus-references/common/dateconverter/DateFormatter');
var reqsvchelper = require('../../../../torus-references/common/serviceHelper/ServiceHelper');
var serviceModel = reqFXDBInstance.DBInstanceSession['SERVICE_MODEL'];


// Service Definition

var objLogInfo;
var mTranDB;
var tasks = [];
var SessionInfo;
var serviceName = 'MailAndSms';
var arrRoutingKeys = []; // To Store All the Routing Keys
function sendMailSMS(request, startupCallback) {
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
    try {
        objLogInfo = {};
        objLogInfo.HANDLER_CODE = 'MAIL/SMS';
        var routingKeyIndex = arrRoutingKeys.findIndex(obj => obj.routingkey == routingkey);
        var task = cron.schedule('*/10 * * * * *', function () {
            // Initialize the DB
            arrRoutingKeys[routingKeyIndex].lastLoopingCount++;
            if (arrRoutingKeys[routingKeyIndex].isDone) {
                arrRoutingKeys[routingKeyIndex].isDone = false;
                _PrintInfo('--------------Mail Sms Cron Job Start --------------');
                makeconnectioncallsendmsg(strReqHeader, function () {
                    arrRoutingKeys[routingKeyIndex].isDone = true;
                    arrRoutingKeys[routingKeyIndex].lastLoopingCount = 0;
                    _PrintInfo('--------------Mail Sms Cron Job End --------------');
                });
            } else {
                reqInstanceHelper.PrintInfo(serviceName, routingkey + 'Already a cron thread is processing. So skiping this cron thread.  IsDone = ' + arrRoutingKeys[routingKeyIndex].isDone, objLogInfo);
                if (arrRoutingKeys[routingKeyIndex].lastLoopingCount > arrRoutingKeys[routingKeyIndex].maxLoopingCount) {
                    reqInstanceHelper.PrintInfo('Looping Count Exceeds the Maximum Looping Count...So Resetting the ISDONE to True', objLogInfo);
                    arrRoutingKeys[routingKeyIndex].isDone = true;
                    arrRoutingKeys[routingKeyIndex].recoveryProcess = true;
                    arrRoutingKeys[routingKeyIndex].lastLoopingCount = 0;
                }
            }
        });
        tasks.push(task);
        startupCallback('Started');
        // });
    } catch (error) {
        console.log(error);
        arrRoutingKeys[routingKeyIndex].isDone = true;
        startupCallback('Failed To Start');
    }
}



function makeconnectioncallsendmsg(strReqHeader, makeconnectioncallsendmsgCB) {
    try {
        reqTranDBHelper.GetTranDBConn(strReqHeader, false, function (pSession) {
            _PrintInfo('TranDB initialized successfully');
            try {
                //Query the Comm_Process_Message for get the SMS OR MAIL TYPE AND MESSAGE
                reqTranDBHelper.GetTableFromTranDB(pSession, 'COMM_PROCESS_MESSAGE', {
                    status: 'CREATED'
                }, objLogInfo, function callback(pResult, pError) {
                    if (pError) {
                        console.log(pError);
                        makeconnectioncallsendmsgCB();
                    } else {
                        if (pResult.length > 0) {
                            _PrintInfo('After Get the data in COMM_PROCESS_MESSAGE table');
                            var result = pResult;
                            //Prepare Mail or sms in one by one data
                            PrePareATMT(result, makeconnectioncallsendmsgCB);
                        } else {
                            _PrintInfo('\n\n----------------------------------Created Data Not Available----------------------------------\n\n');
                            makeconnectioncallsendmsgCB();
                        }
                    }
                });
            } catch (error) {
                _PrintError('Error on COMM_PROCESS_MESSAGE ', "ERR-COM-25001", error);
                makeconnectioncallsendmsgCB();
            }


            //Query the tenant_setup for Get the mail template and SMS tamplates
            function SendMessage(pHeaders, pInputParams, sendmessagecallback) {
                reqFXDBInstance.GetFXDBConnection(pHeaders, 'clt_cas', objLogInfo, function CallbackgetFXDBConn(pClientClt) {
                    try {
                        var MessageObj = JSON.parse(pInputParams.message);
                        var TemplateCode = pInputParams.commmt_code;
                        var Params = pInputParams;
                        // Get mail/sms setup from tenant source
                        var strCommType = pInputParams.type.toUpperCase();
                        var SetupCategory = MessageObj.SCHEDULE.CONFIG_SETUP;//Mail/sms setup get from tenant setup tab;e
                        if (!SetupCategory) {
                            SetupCategory = strCommType + '_SETUP';
                        }
                        var cond = {};
                        cond.setup_code = SetupCategory;
                        if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                            _PrintInfo('Plat form version is  | ' + serviceModel.PLATFORM_VERSION);
                            reqsvchelper.GetSetupJson(pClientClt, cond, objLogInfo, function (res) {
                                if (res.Status == 'SUCCESS') {
                                    _PrintInfo('Got the setup json value');
                                    aftergetsetupJson(res.Data);
                                } else {
                                    sendmessagecallback();
                                }
                            });
                        } else {
                            _PrintInfo('Get the config setup from tenant setup for | ' + SetupCategory);
                            reqFXDBInstance.GetTableFromFXDB(pClientClt, 'tenant_setup', ['setup_json'], {
                                'CLIENT_ID': MessageObj.sessInfo.CLIENT_ID,
                                'TENANT_ID': MessageObj.sessInfo.TENANT_ID || '0',
                                'CATEGORY': SetupCategory
                            }, objLogInfo, function CallbackGetTableFromFXDB(pError, pResult) {
                                if (pError) {
                                    sendmessagecallback();
                                } else {
                                    aftergetsetupJson(pResult.rows);
                                }
                            });
                        }

                        function aftergetsetupJson(pResult) {
                            try {

                                if (pResult != undefined && pResult.length > 0) {
                                    _PrintInfo('Tenant setup available for category - ' + strCommType, objLogInfo);
                                    // Assign communcation config from tenant setup
                                    var strCommSetup = JSON.parse(pResult[0]['setup_json']);
                                    var ObjMessage = {};
                                    _PrintInfo('Communication Type is ' + strCommType);
                                    if (strCommType == "MAIL") {
                                        getstaticatmt(pHeaders, TemplateCode).then(function (atmtRes) {
                                            getDynamicatmt(pHeaders, MessageObj, atmtRes).then(function (FullatmtRes) {
                                                try {
                                                    ObjMessage.Subject = MessageObj.Subject;
                                                    ObjMessage.Body = MessageObj.Message;
                                                    ObjMessage.ATTACHMENTs = FullatmtRes;
                                                    ObjMessage.IsBodyHtml = true;
                                                    ObjMessage.ServerName = strCommSetup.MAIL.SERVERNAME;
                                                    ObjMessage.PortNo = strCommSetup.MAIL.PORTNO;
                                                    ObjMessage.EMailID = strCommSetup.MAIL.EMAILID;
                                                    ObjMessage.Pwd = strCommSetup.MAIL.PASSWORD;
                                                    ObjMessage.To = MessageObj.Address.To || '';
                                                    ObjMessage.Cc = MessageObj.Address.Cc || '';
                                                    ObjMessage.Bcc = MessageObj.Address.Bcc || '';
                                                    ObjMessage.ReplyTo = MessageObj.Address.ReplyTo || '';

                                                    var att = ObjMessage.ATTACHMENTs;
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
                                                    _PrintInfo('Mail sending in progress');
                                                    reqSMTP.SendMail(ObjMessage, objLogInfo, function callbackSendMail(pStatus) {
                                                        try {
                                                            //Update the status Success or Failure for Mail in comm_process_message table
                                                            if (pStatus.Status != "SUCCESS") {
                                                                pStatus.Status = 'FAILED';
                                                            }
                                                            var errorStr = (pStatus && pStatus.Error) ? JSON.stringify(pStatus.Error) : '';
                                                            var updaterow = {
                                                                status: pStatus.Status,
                                                                modified_date: reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                                                comments: errorStr
                                                            };
                                                            var updatecond = {};
                                                            updatecond.commpm_id = Params.commpm_id;

                                                            updatetable('COMM_PROCESS_MESSAGE', updaterow, updatecond, objLogInfo).then(function () {
                                                                sendmessagecallback();
                                                            }).catch(function (error) {
                                                                console.log('Error occured updatetable SMS COMM_PROCESS_MESSAGE ERR-COM-25005' + error);
                                                                sendmessagecallback();
                                                            });
                                                        } catch (error) {
                                                            console.log(error);
                                                            var updaterow = {
                                                                status: 'FAILED',
                                                                modified_date: reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                                                comments: error.message
                                                            };
                                                            var updatecond = {};
                                                            updatecond.commpm_id = Params.commpm_id;
                                                            updatetable('COMM_PROCESS_MESSAGE', updaterow, updatecond, objLogInfo).then(function () {
                                                                sendmessagecallback();
                                                            }).catch(function (error) {
                                                                console.log('Error occured updatetable SMS COMM_PROCESS_MESSAGE ERR-COM-25005' + error);
                                                                sendmessagecallback();
                                                            });
                                                        }
                                                    });
                                                } catch (error) {
                                                    var updaterow = {
                                                        status: 'FAILED',
                                                        modified_date: reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                                        comments: error.message
                                                    };
                                                    var updatecond = {};
                                                    updatecond.commpm_id = Params.commpm_id;
                                                    updatetable('COMM_PROCESS_MESSAGE', updaterow, updatecond, objLogInfo).then(function () {
                                                        sendmessagecallback();
                                                    }).catch(function (error) {
                                                        console.log('Error occured updatetable SMS COMM_PROCESS_MESSAGE ' + error);
                                                        sendmessagecallback();
                                                    });
                                                }
                                            }).catch((error) => {
                                                //Update the status Success or Failure for Sms in comm_process_message table
                                                var updaterow = {
                                                    status: "FAILED",
                                                    modified_date: reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                                    comments: JSON.stringify(error)
                                                };
                                                var updatecond = {};
                                                updatecond.commpm_id = Params.commpm_id;
                                                updatetable('COMM_PROCESS_MESSAGE', updaterow, updatecond, objLogInfo).then(function () {
                                                    sendmessagecallback();
                                                }).catch(function (error) {
                                                    console.log('Error occured updatetable SMS COMM_PROCESS_MESSAGE' + error);
                                                    sendmessagecallback();
                                                });
                                            });
                                        }).catch((error) => {
                                            var updaterow = {
                                                status: 'FAILED',
                                                modified_date: reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                                comments: error.message
                                            };
                                            var updatecond = {};
                                            updatecond.commpm_id = Params.commpm_id;
                                            updatetable('COMM_PROCESS_MESSAGE', updaterow, updatecond, objLogInfo).then(function () {
                                                sendmessagecallback();
                                            }).catch(function (error) {
                                                console.log('Error occured updatetable SMS COMM_PROCESS_MESSAGE ERR-COM-25005' + error);
                                                sendmessagecallback();
                                            });
                                        });
                                    } else if (strCommType == "SMS") {
                                        _PrintInfo('Communication type is SMS', objLogInfo);
                                        //Prepare the Object for send the SMS Properties
                                        ObjMessage.URL = strCommSetup[strCommType].URL;
                                        ObjMessage.To = MessageObj.To;
                                        ObjMessage.Message = MessageObj.Message;
                                        reqSMSAPI.SendSMS(ObjMessage, objLogInfo, function callbacksendsms(pStatus) {
                                            try {
                                                if (pStatus.Status != 'SUCCESS') {
                                                    pStatus.Status = 'FAILED';
                                                }
                                                //Update the status Success or Failure for Sms in comm_process_message table
                                                var updaterow = {
                                                    status: pStatus.Status,
                                                    modified_date: reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                                    comments: pStatus.Error
                                                };
                                                var updatecond = {};
                                                updatecond.commpm_id = Params.commpm_id;
                                                updatetable('COMM_PROCESS_MESSAGE', updaterow, updatecond, objLogInfo).then(function () {
                                                    sendmessagecallback();
                                                }).catch(function (error) {
                                                    console.log('Error occured updatetable SMS COMM_PROCESS_MESSAGE' + error);
                                                    sendmessagecallback();
                                                });
                                            } catch (error) {
                                                var updaterow = {
                                                    status: 'FAILED',
                                                    modified_date: reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                                    comments: error.message
                                                };
                                                var updatecond = {};
                                                updatecond.commpm_id = Params.commpm_id;
                                                updatetable('COMM_PROCESS_MESSAGE', updaterow, updatecond, objLogInfo).then(function () {
                                                    sendmessagecallback();
                                                }).catch(function (error) {
                                                    console.log('Error occured updatetable SMS COMM_PROCESS_MESSAGE ERR-COM-25005' + error);
                                                    sendmessagecallback();
                                                });
                                            }
                                        });
                                    }
                                } else {
                                    sendmessagecallback();
                                }

                            } catch (error) {
                                var updaterow = {
                                    status: 'FAILED',
                                    modified_date: reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                    comments: error.message
                                };
                                var updatecond = {};
                                updatecond.commpm_id = Params.commpm_id;
                                updatetable('COMM_PROCESS_MESSAGE', updaterow, updatecond, objLogInfo).then(function () {
                                    sendmessagecallback();
                                }).catch(function (error) {
                                    console.log('Error occured updatetable SMS COMM_PROCESS_MESSAGE ERR-COM-25005' + error);
                                    sendmessagecallback();
                                });
                            }
                        }

                    } catch (error) {
                        sendmessagecallback();
                    }

                });
            }


            function getstaticatmt(pHeaders, pTemplateCode) {
                return new Promise((resolve, reject) => {
                    try {
                        _PrintInfo('Check and get the static attachments');
                        reqFXDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function CallbackgetFXDBConn(pDepClient) {
                            try {
                                var Wherecond = {};
                                Wherecond.commmt_code = pTemplateCode;
                                reqFXDBInstance.GetTableFromFXDB(pDepClient, 'COMM_STATIC_ATTACHMENTS', ['static_attachment_name', 'static_attachment'], Wherecond, objLogInfo, function (perr, pResult) {
                                    if (perr) {
                                        var updaterow = {
                                            status: 'FAILED',
                                            modified_date: reqDateFormatter.GetTenantCurrentDateTime(pHeaders, objLogInfo),
                                            comments: perr
                                        };
                                        var updatecond = {};
                                        updatecond.commpm_id = Params.commpm_id;
                                        updatetable('COMM_PROCESS_MESSAGE', updaterow, updatecond, objLogInfo).then(function () {
                                            resolve('');
                                        }).catch(function (error) {
                                            console.log('Error occured updatetable SMS COMM_PROCESS_MESSAGE ' + error);
                                            resolve('');
                                        });
                                    } else {
                                        var arrAtt = [];
                                        if (pResult.rows.length) {
                                            _PrintInfo('Static attachment available');
                                            for (var i = 0; i < pResult.rows.length; i++) {
                                                var strB64 = pResult.rows[i]['static_attachment'];
                                                var byt = reqBase64.toByteArray(strB64);
                                                _AddAttachments(arrAtt, pResult.rows[i]['static_attachment_name'], byt, 0);
                                            }
                                            resolve(arrAtt);
                                        } else {
                                            _PrintInfo('Static attachment not available');
                                            resolve(arrAtt);
                                        }
                                    }
                                });
                            } catch (error) {
                                resolve([]);
                            }
                        });
                    } catch (error) {
                        resolve([]);
                    }
                });
            }

            function _AddAttachments(pAttachments, pRelativePath, pByteData, pTrnID) {
                var objAtt = {
                    STATIC_ATTACHMENT_NAME: pRelativePath,
                    STATIC_ATTACHMENT: pByteData,
                    TRN_ID: pTrnID,
                    IsDeleted: false
                };
                pAttachments.push(objAtt);
            }

            function getDynamicatmt(pHeaders, messageobj, atmtRes) {
                return new Promise((resolve, reject) => {
                    try {
                        if (messageobj.ATTACHMENTINFOS.DYNAMICATMT) {
                            _PrintInfo('Dynamic attachment available');
                            var trnatmt = messageobj.ATTACHMENTINFOS.DYNAMICATMTDATA;
                            var dynamictmtarr = [];
                            for (var i = 0; i < trnatmt.length; i++) {
                                var dynamictmtobj = {};
                                dynamictmtobj.RELATIVE_PATH = trnatmt[i].relative_path;
                                dynamictmtobj.AT_CODE = trnatmt[i].at_code;
                                dynamictmtobj.ORIGINAL_FILE_NAME = trnatmt[i].original_file_name;
                                dynamictmtobj.TRN_ID = trnatmt[i].trn_id;
                                dynamictmtarr.push(dynamictmtobj);
                            }

                            reqFXDBInstance.GetFXDBConnection(pHeaders, 'res_cas', objLogInfo, function (resSession) {
                                reqAsync.forEachOfSeries(dynamictmtarr, function (dynamicdataobj, idx, pCallback) {
                                    getAtmtfromrescas(resSession, dynamicdataobj, objLogInfo, function (bytedata) {
                                        if (bytedata) {
                                            _AddAttachments(atmtRes, dynamicdataobj['ORIGINAL_FILE_NAME'], bytedata, dynamicdataobj['TRN_ID']);
                                            pCallback();
                                        }
                                    });
                                }, function (error) {
                                    if (error) {
                                        reject(error);
                                    } else {
                                        _PrintInfo('Dyncamic atmt callback called');
                                        resolve(atmtRes);
                                    }
                                });
                            });
                        } else {
                            _PrintInfo('Dynamic atmt not available');
                            resolve(atmtRes);
                        }
                    } catch (error) {
                        _PrintInfo('Exception occures in dynamic atmt  function' + error);
                        resolve(atmtRes);
                    }
                });
            }



            // To get attachment from resource cassandra
            function getAtmtfromrescas(pResCas, pParams, pLogInfo, pCallback) {
                _PrintInfo('getAtmtfromrescas function called');
                try {
                    var pRelativePath = pParams['RELATIVE_PATH'] ? pParams['RELATIVE_PATH'] : '';
                    var pATCode = pParams['AT_CODE'];
                    reqFXDBInstance.GetTableFromFXDB(pResCas, 'TRNA_DATA', ['byte_data', 'text_data'], {
                        RELATIVE_PATH: pRelativePath
                    }, pLogInfo, function callbackGetTableFromFXDB(pError, pResult) {
                        var byt = null;
                        if (pError) {
                            _PrintError(pLogInfo, 'Error on executing query as TRAN_DATA in resource cassandra', 'ERR-COM-20047', pError);
                            pCallback(null);
                        } else if (pResult) {
                            if (pATCode.toUpperCase() == 'IMG') {
                                if (pResult.rows.length > 0 && pResult.rows[0]['text_data'] != null) {
                                    strBase64 = pResult.rows[0]['text_data'];
                                    byt = reqBase64.toByteArray(strBase64);
                                }
                            } else {
                                if (pResult.rows.length > 0 && pResult.rows[0]['byte_data'] != null) {
                                    byt = pResult.rows[0]['byte_data'];
                                }
                            }
                            pCallback(byt);
                        }
                    });
                } catch (error) {
                    _PrintError(pLogInfo, 'Error on executing query as TRAN_DATA in resource cassandra', 'ERR-COM-20048', error);
                    pCallback(null);
                }
            }

            //Update COMM_PROCESS_MESSAGE Status Function
            function updatetable(ptargettbale, updateRow, updateCond, pLogInfo) {
                return new Promise((resolve, reject) => {
                    try {
                        _PrintInfo('Initialize the Update process status in COMM_PROCESS_MESSAGE Table ');
                        reqTranDBHelper.UpdateTranDBWithAudit(pSession, ptargettbale, updateRow, updateCond, pLogInfo, function (InsertRes, insertErr) {
                            if (insertErr) {
                                reject(insertErr);
                            } else {
                                _PrintInfo('Process status Updated successfully in COMM_PROCESS_MESSAGE Table ');
                                resolve();
                            }
                        });

                    } catch (error) {
                        _PrintInfo('Exception occured ' + error, pLogInfo);
                        resolve(error);
                    }
                });
            }



            //Get the Mail or sms message and to address for Each record one by one 
            function PrePareATMT(data, atmtcallback) {
                try {
                    _PrintInfo('Prepare Each record for send mail or sms based on Type');
                    reqAsync.forEachSeries(data, function (drTran, asycallback) {
                        _PrintInfo('Each Item send the Mail or SMS');
                        SendMessage(strReqHeader, drTran, function sendmessagecallback(res) {
                            asycallback();
                        });
                    }, function (error) {
                        _PrintInfo('Finding Loop ended.');
                        if (error) {

                        } else {

                        }
                        atmtcallback();
                    });
                } catch (error) {
                    atmtcallback();
                }
            }

            function _PrintError(pMessage, pErrorCode, pError) {
                reqInstanceHelper.PrintError('SendMessage', objLogInfo, pErrorCode, pMessage, pError);
            }

            function _PrintInfo(pMessage) {
                reqInstanceHelper.PrintInfo('SendMessage', pMessage, objLogInfo);
            }
        });
    } catch (error) {

    }
}




function _PrintInfo(pMessage, pLogInfo) {
    reqInstanceHelper.PrintInfo('SendMessage', pMessage, pLogInfo);
}

module.exports = {
    sendMailSMS: sendMailSMS
};
