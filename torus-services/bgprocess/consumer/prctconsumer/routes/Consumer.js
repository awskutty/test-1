/****
  @Descriptions     :  To consume PRC_TOKENS_CORE topic to prepare auditing data in solr  
  @Last_Error_Code  :  ERR-PRCT-CONSUMER-0010
 ****/

// Require dependencies
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqkafkaInstance = require('../../../../../torus-references/instance/KafkaInstance');
var reqDBInstance = require('../../../../../torus-references/instance/DBInstance');
var reqAuditLog = require('../../../../../torus-references/log/audit/AuditLog');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');
var reqProducer = require('../../../../../torus-references/common/Producer');
var logFilePath = 'bgprocess/consumer/prctconsumer';
var objLogInfo = reqLogWriter.GetLogInfo('Processtokenconsumer_CONSUMER', 'Processtokenconsumer_CONSUMER_PROCESS', 'Processtokenconsumer_CONSUMER_ACTION', logFilePath);
var reqAsync = require('async');
var cron = require('node-cron');


// Starting consumer for topic TRAN_DATA
function startConsuming(pConsumerName, pTopic, pConsumer, pKafka) {
    try {
        var serviceModel = reqDBInstance.DBInstanceSession['SERVICE_MODEL'];
        var prctokenCore = "PRC_TOKENS_CORE";
        if (serviceModel && serviceModel.PLATFORM_VERSION == '7.0') {
            prctokenCore = "PRC_TOKEN";
        }
        reqInstanceHelper.PrintInfo(pConsumerName, 'Started consuming', objLogInfo);
        reqLogWriter.EventUpdate(objLogInfo);
        var maxKafkaMsgCount = pKafka.maxKafkaMsgCount;
        var deleteHstSchema = {
            "schema": {
                "type": "struct",
                "fields": [
                    {
                        "type": "int32"
                    }
                ]
            },
            "payload": {}
        };
        ConsumeDataFromKafka();
        var prctLogInProgress = false;
        var processedMsgCount = 0;
        var maxProcessingMsgCount = 10000;

        function ConsumeDataFromKafka(params) {
            try {
                cron.schedule('*/1 * * * * *', function () {
                    if (!prctLogInProgress) {
                        prctLogInProgress = true;
                        reqInstanceHelper.PrintInfo(pConsumerName, 'Consuming Data From Kafka...', objLogInfo);
                        CheckProcessedMsgCountAndRestart(null, function (params) {
                            pConsumer.consume(maxKafkaMsgCount, function (error, data) {
                                if (error) {
                                    prctLogInProgress = false;
                                    reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-ATMT-CONSUMER-0003', 'Error While Consuming Data from Kafka...', error);
                                } else {
                                    if (data && data.length) {
                                        var PrctLogProcessReqObj = {};
                                        PrctLogProcessReqObj.hstTableData = data;
                                        PrctLogProcess(PrctLogProcessReqObj);
                                        processedMsgCount = processedMsgCount + data.length;
                                        PrctLogProcessReqObj = {};
                                        data = {};
                                    } else {
                                        reqInstanceHelper.PrintInfo(pConsumerName, 'There is No Data From Kafka...', objLogInfo);
                                        prctLogInProgress = false;
                                    }
                                }
                            });
                        });
                    } else {
                        reqInstanceHelper.PrintInfo(pConsumerName, 'Still Attachment Log Process is Going on...', objLogInfo);
                    }
                });
            } catch (error) {
                reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-ATMT-CONSUMER-0004', 'Catch Error in ConsumeDataFromKafka()...', error);
                prctLogInProgress = false;
            }
        }

        // To Verify and Restart the Service Based on the processed msg Count and Maximum Processing Msg Count
        // Temporary Code For Memory Leak
        function CheckProcessedMsgCountAndRestart(params, CheckProcessedMsgCountAndRestartCB) {
            try {
                reqInstanceHelper.PrintInfo(pConsumerName, 'Total Processed Message Count - ' + processedMsgCount, objLogInfo);
                reqInstanceHelper.PrintInfo(pConsumerName, 'Maximum Processing Message Count - ' + maxProcessingMsgCount, objLogInfo);
                if (processedMsgCount > maxProcessingMsgCount) {
                    reqInstanceHelper.PrintInfo(pConsumerName, 'Going to Restart the Service...', objLogInfo);
                    reqInstanceHelper.restartSvc(objLogInfo);
                } else {
                    CheckProcessedMsgCountAndRestartCB(null, true);
                }
            } catch (error) {
                CheckProcessedMsgCountAndRestartCB(error, null);
            }
        }

        function PrctLogProcess(params, PrctLogProcessCB) {
            try {
                var startTime = '';
                var endTime = '';
                var hstDeleteTopicName = '';
                startTime = new Date().toLocaleString();
                reqInstanceHelper.PrintInfo(pConsumerName, 'Total Message Count - ' + params.hstTableData.length, objLogInfo);
                reqAsync.forEachOfSeries(params.hstTableData, function (message, i, CB) {
                    message.value = message.value.toString(); // To Convert buffer to String while using RdKafka Npm...
                    var strMsg = JSON.parse(message.value);
                    // console.log(message.key, 'key------------', message.partition, 'partition------------', message.offset, '\n=====offset========', message, 'Actual Msg');
                    if (strMsg) {
                        strMsg = reqInstanceHelper.ArrKeyToUpperCase([strMsg])[0];
                        if (message.topic.toUpperCase() !== 'PRC_TOKENS') {
                            var processInfo = JSON.parse(strMsg.PROCESS_INFO);
                            if (message.topic == 'PRF.hst_prc_tokens') {
                                hstDeleteTopicName = 'DELETE_PG_HST_PRC_TOKENS';
                                deleteHstSchema.payload.id = strMsg.ID;
                                deleteHstSchema.schema.fields[0].field = 'id';
                            } else if (message.topic == 'PRF.HST_PRC_TOKENS') {
                                hstDeleteTopicName = 'DELETE_ORA_HST_PRC_TOKENS';
                                deleteHstSchema.payload.ID = strMsg.ID;
                                deleteHstSchema.schema.fields[0].field = 'ID';
                            }
                            strMsg = reqInstanceHelper.ArrKeyToUpperCase([processInfo])[0];
                        }
                        console.log(strMsg, '--------------------------');
                        var headers = strMsg.HEADERS;
                        reqAuditLog.SendPrcTokensToSolr(headers, prctokenCore, strMsg, function (result) {
                            if (message.topic.toUpperCase() !== 'PRC_TOKENS') {
                                // Deleting Hst table Data only for the positive flow and it will be helpful for verify the data for negative cases
                                reqProducer.ProduceMessage(hstDeleteTopicName, null, null, function caalback(res) {
                                    strMsg = {};
                                    CB();
                                }, deleteHstSchema);
                            } else {
                                CB();
                            }
                        });
                    } else {
                        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-PRCT-CONSUMER-0010', 'This is not a Valid Message...', '');
                        CB();
                    }
                },
                    function () {
                        reqkafkaInstance.DoCommit(pKafka, function () {
                            reqInstanceHelper.PrintInfo(pConsumerName, 'Message Committed Successfully...', objLogInfo);
                            prctLogInProgress = false;
                            endTime = new Date().toLocaleString();
                            reqInstanceHelper.PrintInfo(pConsumerName, 'Process Start Time - ' + startTime, objLogInfo);
                            reqInstanceHelper.PrintInfo(pConsumerName, 'Process Start Time - ' + endTime, objLogInfo);
                            params = {};
                            objLogInfo = {};
                            startTime = '';
                            endTime = '';
                        });
                    });
            } catch (error) {
                prctLogInProgress = false;
                reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-PRCT-CONSUMER-0005', 'Catch Error in PrctLogProcess()', error);
            }
        }

    } catch (error) {
        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-PRCT-CONSUMER-0009', 'Catch Error in startConsuming()...', error);
    }
}

module.exports = {
    StartConsuming: startConsuming
};
/******** End of File **********/