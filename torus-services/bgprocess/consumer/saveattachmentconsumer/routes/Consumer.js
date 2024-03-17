/****
  @Descriptions     :  To consume CONTENT_DATA topic for sending otp mail/sms in ap, cp app   
  @Last_Error_Code  :  ERR-SAVEATMT-CONSUMER-0010
 ****/

// Require dependencies
var reqInstanceHelper = require('../../../../../torus-references/common/InstanceHelper');
var reqkafkaInstance = require('../../../../../torus-references/instance/KafkaInstance');
var reqSaveAttachment = require('../../../../../torus-references/common/solrhelper/saveattachment/SaveAttachmentToSolr');
var reqLogWriter = require('../../../../../torus-references/log/trace/LogWriter');
var logFilePath = 'bgprocess/consumer/saveattachmentconsumer';
var objLogInfo = reqLogWriter.GetLogInfo('SAVE_ATTACHMENT_CONSUMER', 'SAVE_ATTACHMENT_CONSUMER_PROCESS', 'SAVE_ATTACHMENT_CONSUMER_ACTION', logFilePath);
var reqAsync = require('async');
var cron = require('node-cron');

// this is for starting consumer
function startConsuming(pConsumerName, pTopic, pConsumer, pKafka) {
    try {
        reqInstanceHelper.PrintInfo(pConsumerName, 'Started consuming', objLogInfo);
        reqLogWriter.EventUpdate(objLogInfo);



        var maxKafkaMsgCount = pKafka.maxKafkaMsgCount;
        ConsumeDataFromKafka();
        var attachmentLogInProgress = false;
        var processedMsgCount = 0;
        var maxProcessingMsgCount = 10000;

        function ConsumeDataFromKafka(params) {
            try {
                cron.schedule('*/1 * * * * *', function () {
                    if (!attachmentLogInProgress) {
                        attachmentLogInProgress = true;
                        reqInstanceHelper.PrintInfo(pConsumerName, 'Consuming Data From Kafka...', objLogInfo);
                        CheckProcessedMsgCountAndRestart(null, function (params) {
                            pConsumer.consume(maxKafkaMsgCount, function (error, data) {
                                if (error) {
                                    attachmentLogInProgress = false;
                                    reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-ATMT-CONSUMER-0003', 'Error While Consuming Data from Kafka...', error);
                                } else {
                                    if (data && data.length) {
                                        var StartAttachmentLogProcessReqObj = {};
                                        StartAttachmentLogProcessReqObj.hstTableData = data;
                                        StartAttachmentLogProcess(StartAttachmentLogProcessReqObj);
                                        processedMsgCount = processedMsgCount + data.length;
                                        StartAttachmentLogProcessReqObj = {};
                                        data = {};
                                    } else {
                                        reqInstanceHelper.PrintInfo(pConsumerName, 'There is No Data From Kafka...', objLogInfo);
                                        attachmentLogInProgress = false;
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
                attachmentLogInProgress = false;
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

        function StartAttachmentLogProcess(params, StartAttachmentLogProcessCB) {
            try {
                var startTime = '';
                var endTime = '';
                startTime = new Date().toLocaleString();
                reqInstanceHelper.PrintInfo(pConsumerName, 'Total Message Count - ' + params.hstTableData.length, objLogInfo);
                reqAsync.forEachOfSeries(params.hstTableData, function (message, i, CB) {
                    message.value = message.value.toString(); // To Convert buffer to String while using RdKafka Npm...
                    var strMsg = JSON.parse(message.value);
                    // console.log(message.key, 'key------------', message.partition, 'partition------------', message.offset, '\n=====offset========', message, 'Actual Msg');
                    if (strMsg) {
                        strMsg = reqInstanceHelper.ArrKeyToUpperCase([strMsg])[0];
                        if (message.topic.toUpperCase() !== 'CONTENT_DATA') {
                            strMsg = JSON.parse(strMsg.NEW_DATA_JSON);
                        }
                        console.log(strMsg, '--------------------------');
                        reqSaveAttachment.StartSaveAttachmentConsumer(strMsg, objLogInfo, function (result) {
                            CB();
                        });
                    } else {
                        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-SAVEATMT-CONSUMER-0010', 'This is not a Valid Message...', '');
                        CB();
                    }
                },
                    function () {
                        reqkafkaInstance.DoCommit(pKafka, function () {
                            reqInstanceHelper.PrintInfo(pConsumerName, 'Message Committed Successfully...', objLogInfo);
                            attachmentLogInProgress = false;
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
                attachmentLogInProgress = false;
                reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-SAVEATMT-CONSUMER-0007', 'Catch Error in StartAttachmentLogProcess()', error);
            }
        }


    } catch (error) {
        reqInstanceHelper.PrintError(pConsumerName, objLogInfo, 'ERR-SAVEATMT-CONSUMER-0009', 'Catch Error in startConsuming()...', error);
    }
}

module.exports = {
    StartConsuming: startConsuming
};
/******** End of File **********/