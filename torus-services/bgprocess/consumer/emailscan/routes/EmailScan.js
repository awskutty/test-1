/****
  Descriptions -  To receive mails and save into email_data   
 ****/

// Require dependencies
var reqPath = require('path');
var fs = require('fs');
var reqDateFormat = require('dateformat');
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqTranDBInstance = require('../../../../../torus-references/instance/TranDBInstance');
var reqEncryptionInstance = require('../../../../../torus-references/common/crypto/EncryptionInstance');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqLinq = require('node-linq').LINQ;
var serviceName = 'EmailScan';
var objLogInfo = null;
var XMLTablePath = process.env.LOCALAPPDATA + '\\FX_Resources\\FX-DB\\XML\\';

// Insert received mails to database - EMAIL_DATA table
function InsertEmailData(pHeaders, pSession, mailData, U_ID, cltId, tntId, callback) {
    try {
        var objM = mailData;
        var drmaildata = new EmailData();
        drmaildata.EMLD_FROM = objM.From[0];
        drmaildata.EMLD_TO = objM.To[0];
        drmaildata.EMLD_SUBJECT = objM.Subject[0];
        drmaildata.EMLD_BODY = objM.Body;
        drmaildata.EMLD_CC = objM.Cc;
        //drmaildata.EMLD_BCC = objM.Bcc;
        drmaildata.CREATED_BY = U_ID;
        drmaildata.EMLD_PLAINTEXT = objM.PlainText;
        drmaildata.CLIENT_ID = cltId;
        drmaildata.TENANT_ID = tntId;
        var insertArr = [];
        insertArr.push(drmaildata);
        reqTranDBInstance.InsertTranDB(pSession, 'EMAIL_DATA', insertArr, objLogInfo, function (result) {
            try {
                var emldId = result[0].emld_id;
                var attachments = objM.Attachments;
                //var totalAttachments = attachments.length;
                if (attachments.length == 0) {
                    //reqTranDBInstance.Commit(pSession, true);
                    return callback('SUCCESS');
                } else {
                    var i = 0;
                    doAttachmentSave(attachments[i]);

                    function doAttachmentSave(attachment) {
                        try {
                            i++;
                            var itm = {};
                            //reqCassandraInstance.GetCassandraConn(pHeaders, 'dep_cas', function (pClient) {
                            reqDBInstance.GetFXDBConnection(pHeaders, 'dep_cas', objLogInfo, function (pClient) {
                                try {
                                    //var ATTACHMENT_TYPES = 'select * from ATTACHMENT_TYPES';
                                    //pClient.execute(ATTACHMENT_TYPES, function (err, result) {
                                    reqDBInstance.GetTableFromFXDB(pClient, 'ATTACHMENT_TYPES', [], {}, objLogInfo, function (error, result) {
                                        try {
                                            if (error) {
                                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                                            } else {
                                                var dtTypeWithExtn = result.rows;
                                                __AssignItem(itm, attachment.Name, attachment.ByteContent, dtTypeWithExtn, U_ID);
                                                var byteData = attachment.ByteContent;
                                                if (!Buffer.isBuffer(byteData)) {
                                                    byteData = new Buffer.from(byteData, 'base64');
                                                }
                                                //var byteData = new Buffer.from(attachment.ByteContent, 'base64');
                                                InsertTranData(pHeaders, pSession, emldId, byteData, itm, function (result) {
                                                    try {
                                                        if (attachments.length == i) {
                                                            return callback(result);
                                                        } else {
                                                            doAttachmentSave(attachments[i]);
                                                        }
                                                    } catch (error) {
                                                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                                                    }
                                                });
                                            }
                                        } catch (error) {
                                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                                        }
                                    });
                                } catch (error) {
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                                }
                            });
                        } catch (error) {
                            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                        }
                    }
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
    }
}

// Create a new guid
function guid() {
    try {
        return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
    }

    function s4() {
        try {
            return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        } catch (error) {
            reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
        }
    }
}

// Insert email attachments byte data to trna_data table
function InsertTranData(pHeaders, pSession, emldId, byteData, itm, callback) {
    try {
        InsertEmlAttachments(pSession, emldId, itm, function (result) {
            try {
                //reqCassandraInstance.GetCassandraConn(pHeaders, 'res_cas', function (pClient) {
                reqDBInstance.GetFXDBConnection(pHeaders, 'res_cas', objLogInfo, function (pClient) {
                    try {
                        var arr = [];
                        var row = new Object();
                        row.TRNAD_ID = ''; //guid();
                        row.RELATIVE_PATH = itm.ImageName.toUpperCase();
                        var dataType;
                        if (itm.AT_CODE.toString().toUpperCase() == 'IMG') {
                            row.TEXT_DATA = byteData.toString('base64');;
                            dataType = ['UUID', 'string', 'string'];
                            arr.push(row);
                        } else {
                            row.BYTE_DATA = byteData;
                            var dataType = ['UUID', 'string', 'blob'];
                            arr.push(row);
                        }
                        reqDBInstance.InsertFXDB(pClient, 'TRNA_DATA', arr, objLogInfo, function (error) {
                            try {
                                if (error) {
                                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                                } else {
                                    return callback(result);
                                }
                            } catch (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                            }
                        }, dataType);
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
    }
}

// Insert attachments entries to eml_attachments
function InsertEmlAttachments(pSession, emldId, detail, callback) {
    try {
        var drAttachmentData = {};
        //var pPath = DRRESOURCESERVERDATA.STORAGE_PATH;
        drAttachmentData.EMLD_ID = emldId;
        drAttachmentData.RELATIVE_PATH = detail.ImageName.toUpperCase();
        drAttachmentData.ORIGINAL_FILE_NAME = reqPath.basename(detail.OriginalImageName);
        drAttachmentData.SOURCE = "EMAIL";
        drAttachmentData.SOURCE_DETAILS = "FROM MAIL";
        drAttachmentData.DTTA_ID = detail.DTTA_ID;
        drAttachmentData.IS_CURRENT = "Y";
        //drAttachmentData.COMMENT_TEXT = pComment_Text;
        drAttachmentData.DTTAC_DESC = "General";
        drAttachmentData.VERSION_NO = 1;
        //drAttachmentData.SORT_ORDER = intSortOrder;
        drAttachmentData.DTTAD_ID = detail.DTTAD_ID;
        drAttachmentData.AT_CODE = detail.AT_CODE;
        drAttachmentData.DTT_CODE = "DTT_FX_EMAIL";
        drAttachmentData.DT_CODE = "DT_FX_EMAIL";
        //drAttachmentData.STS_ID = DPSOperationContext.Current.Info.STS_ID;
        //drAttachmentData.CREATED_BY_STS_ID = DPSOperationContext.Current.Info.STS_ID;
        //drAttachmentData.SYSTEM_ID = s_ID;
        //drAttachmentData.CREATED_BY = U_ID;
        drAttachmentData.CREATED_DATE = new Date();
        //drAttachmentData.RESOURCE_SERVER_CODE = DRRESOURCESERVERDATA.RS_CODE;
        var insertArr = [];
        insertArr.push(drAttachmentData);
        reqTranDBInstance.InsertTranDB(pSession, 'EML_ATTACHMENTS', insertArr, objLogInfo, function (result) {
            try {
                return callback('SUCCESS');
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
            }
        });
    } catch (error) {

    }
}

// Process read mails
function MailReceived(pHeaders, unReadMails, pWFTPAID, SYS_ID, U_ID, cltId, tntId, pObjLogInfo, callback) {
    try {
        if(pObjLogInfo){
            objLogInfo = pObjLogInfo;
        }
        var Need_Attachment_Encryption = '';
        reqInstanceHelper.PrintInfo(serviceName, 'Start', objLogInfo);
        reqInstanceHelper.PrintInfo(serviceName, 'Communication details prepared.', objLogInfo);
        if (unReadMails && unReadMails.length) {
            var dtapplicationsetuptable = 'APPLICATION_SETUP';
            var FilePath = XMLTablePath + "APPLICATION_SETUP" + ".xml";
            var dtAPPSTP = {};
            WriteToTable(pHeaders, unReadMails, SYS_ID, U_ID, cltId, tntId, function (result) {
                try {
                    return callback(result);
                } catch (error) {
                    reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                }
            });
        } else {
            return callback('No New Mails');
        }
        //});   
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
    }
}

// Prepare for insert mail to db
function WriteToTable(pHeaders, unReadMails, SYS_ID, U_ID, cltId, tntId, callback) {
    try {
        reqTranDBInstance.GetTranDBConn(pHeaders, true, function (pSession) {
            try {
                var i = 0;
                saveMail(unReadMails[i]);

                function saveMail(objM) {
                    try {
                        i++;
                        //SaveMailContentasPDF(U_ID, objM, function (mailData) {
                        InsertEmailData(pHeaders, pSession, objM, U_ID, cltId, tntId, function (result) {
                            try {
                                if (i < unReadMails.length) {
                                    saveMail(unReadMails[i]);
                                } else {
                                    reqTranDBInstance.Commit(pSession, true, function (result) {
                                        return callback(result);
                                    });
                                }
                            } catch (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                            }
                        });
                        //});   
                    } catch (error) {
                        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                    }
                }
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
            }
        });
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
    }
}

// Assign trna properties
function __AssignItem(pItem, pImgName, pImgData, dtTypeWithExtn, U_ID) {
    try {
        var strExtension = reqPath.extname(pImgName);
        pItem.AT_CODE = __GetFileType(strExtension, dtTypeWithExtn);
        pItem.ImageName = __GetResourceUniqueName(U_ID) + strExtension;
        pItem.ImageSource = pImgData;
        pItem.OriginalImageName = pImgName;
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
    }
}

// Get file type from extension
function __GetFileType(pExt, dtTypeWithExtn) {
    try {
        var strType = "UNKNOWN";
        //var strcond = 'AT_EXTENSIONS LIKE ' + pExt;
        var dr = new reqLinq(dtTypeWithExtn)
            .Where(function (row) {
                if (row.at_extensions.indexOf(pExt) != -1) {
                    return true;
                } else {
                    return false;
                }
            })
            .ToArray();
        if (dr.length > 0) {
            strType = dr[0].at_code.toString();
        }
        return strType;
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
    }
}

// Form a unique id
function __GetResourceUniqueName(U_ID) {
    try {
        var UniqueNoLockObject = new Object();
        var intUniqueNo = 0;
        var strUsrID = U_ID.toString(); //DPSOperationContext.Current.Info.U_ID
        getPad(9, '0', function (pad) {
            strUsrID = pad + strUsrID;
        });
        var strCurrentDateAndTime = ((Date.now() * 10000) + 621355968000000000); //reqDateFormat(new Date(), "ddMMyyyyHHmmss");
        intUniqueNo = intUniqueNo + 1
        getPad(5, '0', function (pad) {
            intUniqueNo = pad + intUniqueNo;
        });
        reqInstanceHelper.PrintInfo(serviceName, strUsrID + strCurrentDateAndTime + intUniqueNo, objLogInfo);
        reqInstanceHelper.PrintInfo(serviceName, 'End', objLogInfo);
        return (strUsrID + strCurrentDateAndTime + intUniqueNo);
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
    }
}

//this is common function
function getPad(padCount, padChar, callback) {
    try {
        var pad = '';
        for (var j = 0; j < padCount; j++) {
            pad += padChar;
        }
        return callback(pad);
    } catch (error) {
        reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
    }
}

function EmailData() {
    //this.EMLD_ID = 0;
    this.EMLD_FROM = '';
    this.EMLD_TO = '';
    this.EMLD_SUBJECT = '';
    this.EMLD_BODY = '';
    this.EMLD_CC = '';
    this.STATUS = 'EMAIL_DOWNLOADED';
    this.CREATED_BY = '';
    this.CREATED_DATE = new Date();
    this.EMLD_PLAINTEXT = '';
    this.VERSION_NO = 0;
}

module.exports = {
    MailReceived: MailReceived
}
/******** End of File **********/