/*
  @Decsription: To produce given data to KAFKA or SOLR based service model  
  @Last_Error_Code  :  ERR_COMMON_PRODUCER_0001
*/

// Require dependencies 
var Replace = require('replaceall');
var reqInstanceHelper = require('./InstanceHelper');
var reqDBInstance = require('../instance/DBInstance');
var reqKafkaInstance = require('../instance/KafkaInstance');
var reqSolrLogHelper = require('../log/trace/SolrLogHelper');
var reqSendMailPrep = require('../communication/otp/wp/SendMailPrep');
var reqPlatformUserSMSMail = require('../communication/otp/apcp/PlatformUserSMSMail.js');
var reqAuditLog = require('../log/audit/AuditLog.js');
var serviceName = 'Producer';

// Produce message for kafka
function ProduceMsg(pTopicName, pData, pHeaders, callback, pkey) {
    var objLogInfo = {};
    var reqLogWriter = require('../log/trace/LogWriter');
    try {
        console.log('inside common ProduceMsg');
        if (typeof pData == 'string') {
            pData = JSON.parse(pData);
        }
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];

        var prcToken = "PRC_TOKENS_CORE";
        if (serviceModel && serviceModel.PLATFORM_VERSION == '7.0') {
            prcToken = "PRC_TOKEN";
            if (!pTopicName) {
                if (callback) {
                    return callback('FAILURE');
                } else {
                    return;
                }
            }
            else if (pTopicName == 'TRACE_LOG') {
                if (pData.BGPROCESS_FILEPATH && !pData.NEED_SOLR_LOG) {
                    if (callback) {
                        return callback('SUCCESS');
                    }
                } else {
                    if (pData.MESSAGE && pData.ACTION !== 'ArchivalProcess') {
                        pData.MESSAGE = Replace("<", "&lt;", pData.MESSAGE);
                        var strBuffer = new Buffer.from(pData.MESSAGE);
                        pData.MESSAGE = strBuffer.toString('base64');
                        strBuffer = null;
                        //if (pData && pData.headers) delete pData.headers;
                    } else {
                        if (callback) {
                            return callback('SUCCESS');
                        }
                    }
                }
            }
        } else {
            // For Download Compatibility
            pData.headers = pHeaders;
        }
        if (serviceModel) {
            if (serviceModel.TYPE == 'LITE') {
                if (serviceModel.PLATFORM_VERSION && serviceModel.PLATFORM_VERSION == '7.0') {
                    doKafkaInsert();
                } else {
                    doSOLRInsert();
                }
            } else { //} if (serviceModel.TYPE == 'ULTIMATE') { 
                doKafkaInsert();
            }
        } else {
            doKafkaInsert();
        }

        function doKafkaInsert() {
            try {
                reqKafkaInstance.GetKafkaInstance(pHeaders, async function (pKafka) {
                    try {
                        pData = (pData && Buffer.from(JSON.stringify(pData))) || null;
                        pkey = (pkey && Buffer.from(JSON.stringify(pkey))) || null;
                        // console.log(JSON.stringify(pData, null, '\t'), '======================================================');
                        var mProducer = pKafka.Producer;
                        reqLogWriter.DeleteLogInfoFrmHeaders(pData);
                        if (pData) {
                            if (pKafka.isLatestPlatformVersion) {
                                try {
                                    await mProducer.send({
                                        topic: pTopicName,
                                        messages: [
                                            { value: pData.toString() },
                                        ],
                                    })
                                } catch (error) {
                                    console.log(error)
                                }
                                pData = null;
                                pHeaders = null;
                                if (callback) {
                                    return callback('SUCCESS');
                                }
                            } else {
                                mProducer.send([{
                                    topic: pTopicName, partition: 0, messages: JSON.stringify(pData),
                                }], function (err, result) {
                                    if (err) {
                                        console.log('Kafka producer error : ' + err);
                                        if (callback) {
                                            return callback('FAILURE');
                                        }
                                    } else {
                                        if (callback) {
                                            return callback('SUCCESS');
                                        }
                                    }
                                });
                            }
                        } else {
                            reqInstanceHelper.PrintInfo(serviceName, "Data is null, no need to insert the data into kafka ", objLogInfo);
                            return callback('FAILURE');
                        }
                    } catch (err) {
                        console.log('Kafka producer error 2 : ' + err.stack);
                        if (callback) {
                            return callback('FAILURE');
                        }
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                if (callback) {
                    return callback('FAILURE');
                }
            }
        }

        function doSOLRInsert() {
            function cb(result) {
                if (callback) {
                    return callback('SUCCESS');
                }
            }
            switch (pTopicName.toUpperCase()) {
                case 'TRACE_LOG':
                    if (pData.BGPROCESS_FILEPATH) {
                        reqSolrLogHelper.SaveLogToFile(pData, function (result) {
                            try {
                                cb();
                            } catch (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                            }
                        });
                    } else {
                        reqSolrLogHelper.SaveLogToSolr(pData, function (result) {
                            try {
                                cb();
                            } catch (error) {
                                reqInstanceHelper.PrintError(serviceName, objLogInfo, 'errcode', 'errmsg', error);
                            }
                        });
                    }

                    break;
                case 'TRAN_DATA':
                    //to savetran
                    var reqSaveTranToSolrHelper = require('./solrhelper/savetran/SaveTranToSolrHelper');
                    if (pData) {
                        reqSaveTranToSolrHelper.TranIndex(pData, objLogInfo, cb);
                    }
                    break;
                case 'CONTENT_DATA':
                    var reqSaveAttachment = require('./solrhelper/saveattachment/SaveAttachmentToSolr');
                    reqSaveAttachment.StartSaveAttachmentConsumer(pData, objLogInfo, function (result) {
                        if (callback) {
                            return callback(result);
                        }
                    });
                    break;
                case 'AUDIT_DATA':
                    //to audit log
                    reqAuditLog.StartAuditLog(pData, objLogInfo, function (pStatus, solrStatus) {
                        if (pStatus.toUpperCase() == 'SUCCESS') {
                            return callback('SUCCESS', null);
                        } else {
                            return callback('FAILURE', solrStatus);
                        }
                    });
                    break;
                case 'OTP':
                    reqSendMailPrep.MailPrep(pData, objLogInfo, cb);
                    break;
                case 'APCP_OTP':
                    reqPlatformUserSMSMail.PltSMSMailPrep(pData, cb);
                    break;
                case 'PRC_TOKENS':
                    pData = reqInstanceHelper.ArrKeyToUpperCase([pData])[0];
                    reqAuditLog.SendPrcTokensToSolr(pData.headers, prcToken, pData, function (result) {

                        if (callback) {
                            return callback(result);
                        }
                    });
                    break;
                default:
                    break;
            }
        }
    } catch (error) {
        console.log(error);
        if (callback) {
            return callback('FAILURE');
        }
    }
}

// Export functions and properties
module.exports = {
    ProduceMessage: ProduceMsg
};
    /********* End of File *************/